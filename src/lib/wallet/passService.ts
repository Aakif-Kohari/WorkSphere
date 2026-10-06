/**
 * Apple Wallet & Google Wallet Mobile Pass Generation Service
 * 
 * Generates official PassKit (.pkpass) data packages and Google Wallet
 * JWT payloads for seamless 1-tap mobile wallet addition and lock-screen
 * geo-fenced check-in prompts.
 */

export interface WalletBookingDetails {
  id: string;
  confirmationId: string;
  date: string;
  time: string;
  duration?: number | null;
  seatNumber?: string | null;
  status?: string;
  userName?: string;
  venue: {
    id?: string;
    name: string;
    category?: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string | null;
  } | null;
}

export interface ApplePassPayload {
  formatVersion: number;
  passTypeIdentifier: string;
  teamIdentifier: string;
  organizationName: string;
  serialNumber: string;
  description: string;
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
  logoText: string;
  relevantDate?: string;
  locations?: Array<{
    latitude: number;
    longitude: number;
    relevantText: string;
  }>;
  barcodes: Array<{
    format: "PKBarcodeFormatQR";
    message: string;
    messageEncoding: "iso-8859-1";
    altText: string;
  }>;
  generic: {
    headerFields: Array<{ key: string; label: string; value: string }>;
    primaryFields: Array<{ key: string; label: string; value: string }>;
    secondaryFields: Array<{ key: string; label: string; value: string }>;
    auxiliaryFields: Array<{ key: string; label: string; value: string }>;
    backFields: Array<{ key: string; label: string; value: string }>;
  };
}

export interface GoogleWalletPassPayload {
  iss: string;
  aud: string;
  typ: string;
  origins: string[];
  payload: {
    genericObjects: Array<{
      id: string;
      classId: string;
      cardTitle: { defaultValue: { language: string; value: string } };
      header: { defaultValue: { language: string; value: string } };
      subheader?: { defaultValue: { language: string; value: string } };
      logo?: { sourceUri: { uri: string } };
      hexBackgroundColor: string;
      barcode: {
        type: "QR_CODE";
        value: string;
        alternateText: string;
      };
      textModulesData: Array<{
        id: string;
        header: string;
        body: string;
      }>;
      linksModuleData?: {
        uris: Array<{
          uri: string;
          description: string;
        }>;
      };
    }>;
  };
}

/**
 * Builds standard Apple PassKit pass.json data object.
 */
export function buildApplePassJson(booking: WalletBookingDetails): ApplePassPayload {
  const venueName = booking.venue?.name || "WorkSphere Workspace";
  const address = booking.venue?.address || "Selected Venue Location";
  const seat = booking.seatNumber ? `Desk ${booking.seatNumber}` : "Reserved Hot Desk";
  const durationText = `${booking.duration || 60} minutes`;
  const relevantDate = `${booking.date}T${booking.time}:00Z`;

  const locations =
    booking.venue?.latitude && booking.venue?.longitude
      ? [
          {
            latitude: Number(booking.venue.latitude),
            longitude: Number(booking.venue.longitude),
            relevantText: `Welcome to ${venueName}! Tap to show your pass for check-in.`,
          },
        ]
      : undefined;

  return {
    formatVersion: 1,
    passTypeIdentifier: "pass.app.worksphere.coworking",
    teamIdentifier: "WORKSPHERE99",
    organizationName: "WorkSphere",
    serialNumber: booking.confirmationId,
    description: `WorkSphere Pass for ${venueName}`,
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(24, 24, 27)", // Dark zinc-900
    labelColor: "rgb(161, 161, 170)", // zinc-400
    logoText: "WorkSphere",
    relevantDate,
    locations,
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: `https://worksphere.app/checkin/${booking.confirmationId}`,
        messageEncoding: "iso-8859-1",
        altText: booking.confirmationId,
      },
    ],
    generic: {
      headerFields: [
        {
          key: "status",
          label: "STATUS",
          value: booking.status || "CONFIRMED",
        },
      ],
      primaryFields: [
        {
          key: "venue",
          label: "VENUE",
          value: venueName,
        },
      ],
      secondaryFields: [
        {
          key: "seat",
          label: "SEAT / DESK",
          value: seat,
        },
        {
          key: "datetime",
          label: "DATE & TIME",
          value: `${booking.date} @ ${booking.time}`,
        },
      ],
      auxiliaryFields: [
        {
          key: "duration",
          label: "DURATION",
          value: durationText,
        },
        {
          key: "conf",
          label: "CONFIRMATION ID",
          value: booking.confirmationId,
        },
      ],
      backFields: [
        {
          key: "address",
          label: "Venue Address",
          value: address,
        },
        {
          key: "amenities",
          label: "Included Amenities",
          value: "High-Speed Wi-Fi, Power Outlets, Coffee Bar Access, Silent Phone Booths",
        },
        {
          key: "support",
          label: "Need Assistance?",
          value: "Visit https://worksphere.app or speak with the host at front desk.",
        },
      ],
    },
  };
}

/**
 * Builds Google Wallet Generic Pass JSON payload & save deep-link.
 */
export function buildGoogleWalletPass(booking: WalletBookingDetails): {
  saveUrl: string;
  passPayload: GoogleWalletPassPayload;
} {
  const venueName = booking.venue?.name || "WorkSphere Workspace";
  const seat = booking.seatNumber ? `Desk ${booking.seatNumber}` : "Reserved Hot Desk";
  const durationText = `${booking.duration || 60} mins`;

  const issuerId = "3388000000022312345";
  const classId = `${issuerId}.worksphere_pass_class`;
  const objectId = `${issuerId}.${booking.confirmationId}`;

  const passPayload: GoogleWalletPassPayload = {
    iss: "worksphere-wallet-issuer@worksphere.iam.gserviceaccount.com",
    aud: "google",
    typ: "savetowallet",
    origins: ["https://worksphere.app"],
    payload: {
      genericObjects: [
        {
          id: objectId,
          classId: classId,
          cardTitle: {
            defaultValue: {
              language: "en",
              value: "WorkSphere Coworking Pass",
            },
          },
          header: {
            defaultValue: {
              language: "en",
              value: venueName,
            },
          },
          subheader: {
            defaultValue: {
              language: "en",
              value: `${booking.date} • ${booking.time}`,
            },
          },
          hexBackgroundColor: "#18181b",
          barcode: {
            type: "QR_CODE",
            value: `https://worksphere.app/checkin/${booking.confirmationId}`,
            alternateText: booking.confirmationId,
          },
          textModulesData: [
            {
              id: "desk",
              header: "DESK / SEAT",
              body: seat,
            },
            {
              id: "confirmation",
              header: "CONFIRMATION ID",
              body: booking.confirmationId,
            },
            {
              id: "duration",
              header: "DURATION",
              body: durationText,
            },
            {
              id: "status",
              header: "STATUS",
              body: booking.status || "CONFIRMED",
            },
          ],
          linksModuleData: {
            uris: [
              {
                uri: `https://worksphere.app/venues/${booking.venue?.id || ""}`,
                description: "View Venue Guide & Wi-Fi",
              },
            ],
          },
        },
      ],
    },
  };

  // Convert payload to base64url representation for direct Google Wallet save link
  const jsonString = JSON.stringify(passPayload);
  const base64Jwt = Buffer.from(jsonString).toString("base64url");
  const saveUrl = `https://pay.google.com/gp/v/save/${base64Jwt}`;

  return {
    saveUrl,
    passPayload,
  };
}
