import path from "path";
import fs from "fs";
import { verifyMembershipProof, ZkProofPayload } from "./verify";
import { poseidonHash } from "./poseidon";
import { isUniversityMerkleRootActive } from "./studentMembership";
import { prisma } from "@/lib/prisma";

export interface MultiVenueBatchProofItem {
  venueId: string;
  proof: ZkProofPayload["proof"];
  publicSignals: string[];
  signature?: string;
}

export interface MultiVenueBatchVerifyRequest {
  clusterId: string;
  clusterMerkleRoot: string;
  venueProofs: MultiVenueBatchProofItem[];
}

export interface MultiVenueBatchVerifyResponse {
  valid: boolean;
  verifiedCount: number;
  totalCount: number;
  results: {
    venueId: string;
    valid: boolean;
    error?: string;
  }[];
  clusterHash: string;
}

export interface BatchStudentDiscountItem {
  id?: string;
  studentId?: string;
  userId?: string;
  proof: any;
  publicSignals: string[];
  nullifierHash?: string;
  root?: string;
  epoch?: number | string;
  witness?: string;
}

export interface BatchStudentDiscountRequest {
  institutionId?: string;
  epoch?: number | string;
  items?: BatchStudentDiscountItem[];
  studentProofs?: BatchStudentDiscountItem[];
}

export interface BatchStudentDiscountResultItem {
  id?: string;
  userId?: string;
  studentId?: string;
  valid: boolean;
  nullifierHash?: string;
  discountEligible: boolean;
  discountCode?: string;
  discountPercentage?: number;
  error?: string;
}

export interface BatchStudentDiscountResponse {
  valid: boolean;
  verifiedCount: number;
  failedCount: number;
  totalCount: number;
  results: BatchStudentDiscountResultItem[];
  batchHash: string;
}

export function computeClusterMerkleHash(venueIds: string[]): string {
  if (!venueIds || venueIds.length === 0) return "0";
  const sorted = [...venueIds].sort();
  const hashes = sorted.map((id) =>
    poseidonHash([BigInt(id.replace(/\D/g, "") || "1")]),
  );
  return hashes
    .reduce((acc, h) => poseidonHash([BigInt(acc), BigInt(h)]).toString(), "0");
}

export async function verifyMultiVenueBatchProofs(
  request: MultiVenueBatchVerifyRequest,
): Promise<MultiVenueBatchVerifyResponse> {
  const results = [];
  let verifiedCount = 0;

  for (const item of request.venueProofs) {
    try {
      const isValid = await verifyMembershipProof(
        item.proof,
        item.publicSignals,
      );
      if (isValid) {
        verifiedCount++;
        results.push({ venueId: item.venueId, valid: true });
      } else {
        results.push({
          venueId: item.venueId,
          valid: false,
          error: "Invalid ZK proof",
        });
      }
    } catch (err: any) {
      results.push({
        venueId: item.venueId,
        valid: false,
        error: err?.message || "Verification failed",
      });
    }
  }

  const clusterHash = computeClusterMerkleHash(
    request.venueProofs.map((v) => v.venueId),
  );

  return {
    valid:
      verifiedCount === request.venueProofs.length &&
      request.venueProofs.length > 0,
    verifiedCount,
    totalCount: request.venueProofs.length,
    results,
    clusterHash,
  };
}

/**
 * Verifies a batch of zero-knowledge student discount credentials.
 */
export async function verifyBatchStudentDiscountProofs(
  request: BatchStudentDiscountRequest,
): Promise<BatchStudentDiscountResponse> {
  const items = request.items || request.studentProofs || [];
  const results: BatchStudentDiscountResultItem[] = [];
  let verifiedCount = 0;

  // Load verification keys
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const snarkjs = require("snarkjs");
  const studentMembershipVKeyPath = path.join(
    process.cwd(),
    "public",
    "zkp",
    "student_membership_vkey.json",
  );
  const studentPassVKeyPath = path.join(
    process.cwd(),
    "public",
    "zkp",
    "student_access_pass_vkey.json",
  );
  const fallbackVKeyPath = path.join(
    process.cwd(),
    "public",
    "zkp",
    "verification_key.json",
  );

  const seenBatchNullifiers = new Set<string>();

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const itemId = item.id || item.studentId || `item-${index + 1}`;

    try {
      if (!item.proof || !item.publicSignals || !Array.isArray(item.publicSignals)) {
        results.push({
          id: itemId,
          userId: item.userId,
          studentId: item.studentId,
          valid: false,
          discountEligible: false,
          error: "Missing proof or publicSignals in item payload",
        });
        continue;
      }

      // Extract root, epoch, nullifierHash
      let root = item.root ? String(item.root) : String(item.publicSignals[0]);
      let epoch = item.epoch ? Number(item.epoch) : request.epoch ? Number(request.epoch) : 2026;
      let nullifierHash: string | null = item.nullifierHash ? String(item.nullifierHash) : null;

      if (!nullifierHash && item.publicSignals.length >= 3) {
        const sig1 = String(item.publicSignals[1]);
        const sig2 = String(item.publicSignals[2]);
        if (sig1.length <= 6 && !isNaN(Number(sig1))) {
          epoch = Number(sig1);
          nullifierHash = sig2;
        } else if (sig2.length <= 6 && !isNaN(Number(sig2))) {
          epoch = Number(sig2);
          nullifierHash = sig1;
        } else {
          nullifierHash = sig2;
        }
      } else if (!nullifierHash && item.publicSignals.length === 2) {
        if (!isNaN(Number(item.publicSignals[1])) && Number(item.publicSignals[1]) < 100000) {
          epoch = Number(item.publicSignals[1]);
        } else {
          nullifierHash = String(item.publicSignals[1]);
        }
      } else if (!nullifierHash && item.publicSignals.length === 1 && !item.root) {
        nullifierHash = String(item.publicSignals[0]);
      }

      // Check university Merkle root
      if (item.publicSignals.length >= 2 || item.root) {
        const isRootActive = await isUniversityMerkleRootActive(root, epoch);
        if (!isRootActive) {
          results.push({
            id: itemId,
            userId: item.userId,
            studentId: item.studentId,
            valid: false,
            discountEligible: false,
            error: "Invalid or inactive university Merkle root",
          });
          continue;
        }
      }

      // Check intra-batch nullifier duplicate
      if (nullifierHash) {
        if (seenBatchNullifiers.has(nullifierHash)) {
          results.push({
            id: itemId,
            userId: item.userId,
            studentId: item.studentId,
            valid: false,
            discountEligible: false,
            nullifierHash,
            error: "Duplicate nullifier detected within the same verification batch",
          });
          continue;
        }
        seenBatchNullifiers.add(nullifierHash);

        // Check persistent nullifier database
        try {
          const existingClaim = await prisma.studentClaimNullifier.findUnique({
            where: { nullifierHash },
          });

          if (existingClaim) {
            results.push({
              id: itemId,
              userId: item.userId,
              studentId: item.studentId,
              valid: false,
              discountEligible: false,
              nullifierHash,
              error: "Nullifier already spent for student discount",
            });
            continue;
          }
        } catch {
          // Table check fallback
        }
      }

      // Choose verification key
      let keyPath = fallbackVKeyPath;
      if (item.publicSignals.length === 3 && fs.existsSync(studentPassVKeyPath)) {
        keyPath = studentPassVKeyPath;
      } else if (item.publicSignals.length === 2 && fs.existsSync(studentMembershipVKeyPath)) {
        keyPath = studentMembershipVKeyPath;
      } else if (fs.existsSync(studentMembershipVKeyPath)) {
        keyPath = studentMembershipVKeyPath;
      } else if (fs.existsSync(fallbackVKeyPath)) {
        keyPath = fallbackVKeyPath;
      }

      if (!fs.existsSync(keyPath)) {
        results.push({
          id: itemId,
          userId: item.userId,
          studentId: item.studentId,
          valid: false,
          discountEligible: false,
          error: "Verification key artifact not found on server",
        });
        continue;
      }

      const vKey = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
      let isValid = false;

      try {
        isValid = await snarkjs.groth16.verify(vKey, item.publicSignals, item.proof);
      } catch (err: any) {
        results.push({
          id: itemId,
          userId: item.userId,
          studentId: item.studentId,
          valid: false,
          discountEligible: false,
          error: err?.message || "Groth16 verification failed",
        });
        continue;
      }

      if (isValid) {
        verifiedCount++;

        // Persist nullifier & user status if userId is provided
        if (item.userId) {
          try {
            if (nullifierHash) {
              await prisma.$transaction([
                prisma.studentClaimNullifier.create({
                  data: {
                    nullifierHash,
                    epoch: Number(epoch) || 2026,
                  },
                }),
                prisma.user.update({
                  where: { id: item.userId },
                  data: { isVerifiedStudent: true },
                }),
              ]);
            } else {
              await prisma.user.update({
                where: { id: item.userId },
                data: { isVerifiedStudent: true },
              });
            }
          } catch {
            // Nullifier or user update error handled
          }
        } else if (nullifierHash) {
          try {
            await prisma.studentClaimNullifier.create({
              data: {
                nullifierHash,
                epoch: Number(epoch) || 2026,
              },
            });
          } catch {
            // Nullifier storage fallback
          }
        }

        results.push({
          id: itemId,
          userId: item.userId,
          studentId: item.studentId,
          valid: true,
          nullifierHash: nullifierHash || undefined,
          discountEligible: true,
          discountCode: "STUDENT20",
          discountPercentage: 20,
        });
      } else {
        results.push({
          id: itemId,
          userId: item.userId,
          studentId: item.studentId,
          valid: false,
          discountEligible: false,
          error: "Invalid zero-knowledge proof",
        });
      }
    } catch (err: any) {
      results.push({
        id: itemId,
        userId: item.userId,
        studentId: item.studentId,
        valid: false,
        discountEligible: false,
        error: err?.message || "Verification processing failed",
      });
    }
  }

  const batchHash = computeClusterMerkleHash(
    items.map((it, i) => it.id || it.studentId || it.userId || String(i)),
  );

  return {
    valid: verifiedCount === items.length && items.length > 0,
    verifiedCount,
    failedCount: items.length - verifiedCount,
    totalCount: items.length,
    results,
    batchHash,
  };
}

