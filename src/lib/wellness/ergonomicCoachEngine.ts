/**
 * Dynamic Ergonomic Health & Biometric Break Coach Engine
 * Provides real-time posture check interval tracking, 20-20-20 eye strain countdowns,
 * sit-to-stand posture ratios, micro-stretch biomechanical catalog, hydration targets,
 * and dynamic Strain Risk Index (SRI) scoring.
 */

export interface MicroStretchRoutine {
  id: string;
  name: string;
  category: 'neck_spine' | 'upper_body' | 'wrists_hands' | 'lower_body' | 'eyes_focus';
  targetMuscles: string[];
  durationSeconds: number;
  difficulty: 'easy' | 'moderate';
  instructions: string[];
  ergonomicBenefit: string;
  iconName: string;
}

export interface ErgonomicSessionState {
  sessionId: string;
  userId?: string;
  deskType: 'standard_seated' | 'height_adjustable_sit_stand' | 'standing_only';
  currentPostureState: 'sitting' | 'standing';
  sessionStartTime: number;
  lastPostureStateChange: number;
  totalSittingSeconds: number;
  totalStandingSeconds: number;
  completedStretches: string[];
  postureCheckIns: Array<{ timestamp: number; rating: 'aligned' | 'slouching' | 'stiff' }>;
  waterIntakeMl: number;
  waterTargetMl: number;
  eyeBreaksCompleted: number;
  skippedBreaksCount: number;
}

export interface ErgonomicStrainScore {
  score: number; // 0 - 100 (100 is optimal, <40 is critical fatigue)
  tier: 'optimal' | 'good' | 'mild_strain' | 'high_strain' | 'critical_fatigue';
  factors: {
    postureBalanceScore: number;
    stretchComplianceScore: number;
    hydrationScore: number;
    eyeRestScore: number;
  };
  recommendation: string;
  nextSuggestedAction: string;
}

export const MICRO_STRETCH_CATALOG: MicroStretchRoutine[] = [
  {
    id: 'neck-chin-tuck',
    name: 'Cervical Retraction & Chin Tuck',
    category: 'neck_spine',
    targetMuscles: ['Deep Neck Flexors', 'Suboccipitals', 'Upper Trapezius'],
    durationSeconds: 30,
    difficulty: 'easy',
    instructions: [
      'Sit tall with your shoulders relaxed and gaze straight ahead.',
      'Gently retract your head straight backward as if making a double chin, without tilting your head down.',
      'Hold for 5 seconds, release smoothly, and repeat 5 times.',
      'Relieves cervical spine compression from forward-head screen staring.'
    ],
    ergonomicBenefit: 'Counters forward head posture (tech-neck) and reduces cervical disc pressure.',
    iconName: 'Activity'
  },
  {
    id: 'thoracic-open-book',
    name: 'Seated Thoracic Spine Opener',
    category: 'neck_spine',
    targetMuscles: ['Thoracic Spine', 'Pectoralis Major', 'Rhomboids'],
    durationSeconds: 45,
    difficulty: 'easy',
    instructions: [
      'Place both hands behind your head with elbows flaring wide.',
      'Inhale deeply and arch your upper back gently over the chair backrest.',
      'Look toward the ceiling while maintaining gentle abdominal engagement.',
      'Hold for 3 breaths, then rotate your torso gently 5 times left and right.'
    ],
    ergonomicBenefit: 'Mobilizes the mid-back and opens chest muscles tight from keyboard hunching.',
    iconName: 'Sun'
  },
  {
    id: 'carpal-median-nerve-glide',
    name: 'Median Nerve Glide & Wrist Extension',
    category: 'wrists_hands',
    targetMuscles: ['Flexor Carpi Radialis', 'Median Nerve Path', 'Extensor Digitorum'],
    durationSeconds: 30,
    difficulty: 'easy',
    instructions: [
      'Extend one arm in front of you at shoulder level, palm facing up.',
      'Use the opposite hand to gently pull your fingers downward toward your body until you feel a gentle forearm stretch.',
      'Hold for 12 seconds, flip palm down and gently push hand backward for 12 seconds.',
      'Repeat on the contralateral arm.'
    ],
    ergonomicBenefit: 'Reduces carpal tunnel intra-neural pressure and repetitive strain injury (RSI) risks.',
    iconName: 'Zap'
  },
  {
    id: 'standing-hip-flexor-lunge',
    name: 'Standing Desk Iliopsoas & Hip Release',
    category: 'lower_body',
    targetMuscles: ['Iliopsoas', 'Rectus Femoris', 'Gluteus Maximus'],
    durationSeconds: 60,
    difficulty: 'moderate',
    instructions: [
      'Stand up and step one foot back into a shallow staggered stance.',
      'Tuck your pelvis slightly under and squeeze the glute of your rear leg.',
      'Shift your weight forward slightly until you feel an elongation in the front hip.',
      'Reach the arm on the same side upward for a deeper stretch. Hold 25s per side.'
    ],
    ergonomicBenefit: 'Relieves prolonged hip flexion shortening and lumbar anterior pull caused by long sitting sessions.',
    iconName: 'TrendingUp'
  },
  {
    id: 'scapular-retraction-pinch',
    name: 'Shoulder Blade Wall / Chair Angels',
    category: 'upper_body',
    targetMuscles: ['Rhomboids', 'Middle & Lower Trapezius', 'Posterior Deltoids'],
    durationSeconds: 40,
    difficulty: 'easy',
    instructions: [
      'Draw your shoulder blades down and together as if pinching a pencil between them.',
      'Keep your neck long and shoulders away from your ears.',
      'Raise arms in a "W" shape, hold contraction for 3 seconds, then release.',
      'Perform 8 deliberate repetitions.'
    ],
    ergonomicBenefit: 'Strengthens postural postural stabilizers and counteracts rounded shoulder slouch.',
    iconName: 'Shield'
  },
  {
    id: 'twenty-twenty-eye-reset',
    name: '20-20-20 Ocular Reset & Palming',
    category: 'eyes_focus',
    targetMuscles: ['Ciliary Muscle', 'Extraocular Muscles'],
    durationSeconds: 20,
    difficulty: 'easy',
    instructions: [
      'Shift your focus from your monitor to an object at least 20 feet (6 meters) away.',
      'Blink deliberately 10 times to re-moisturize the corneal surface.',
      'Rub palms together until warm and gently cup them over closed eyes for 10 seconds of dark resting.'
    ],
    ergonomicBenefit: 'Relaxes eye ciliary spasm, combats digital eye strain (asthenopia), and prevents dry eyes.',
    iconName: 'Eye'
  }
];

export class ErgonomicCoachEngine {
  /**
   * Calculates the real-time Ergonomic Strain Score (0-100)
   */
  public static calculateStrainScore(state: ErgonomicSessionState): ErgonomicStrainScore {
    const elapsedSeconds = Math.max(1, (Date.now() - state.sessionStartTime) / 1000);
    const elapsedHours = elapsedSeconds / 3600;

    // 1. Posture Balance Score (Sit vs Stand ratio)
    // Optimal: 60-70% sit, 30-40% stand for sit-stand desks; or regular posture check-ins for standard desk
    let postureBalanceScore = 100;
    const totalPosTime = state.totalSittingSeconds + state.totalStandingSeconds;
    
    if (state.deskType === 'height_adjustable_sit_stand' && totalPosTime > 600) {
      const standRatio = state.totalStandingSeconds / totalPosTime;
      if (standRatio < 0.15) {
        postureBalanceScore = Math.max(40, 100 - (0.15 - standRatio) * 300);
      } else if (standRatio > 0.65) {
        postureBalanceScore = Math.max(50, 100 - (standRatio - 0.65) * 200);
      }
    } else {
      // Continuous sitting penalty (> 60 minutes uninterrupted sitting)
      const currentContinuous = state.currentPostureState === 'sitting'
        ? (Date.now() - state.lastPostureStateChange) / 1000
        : 0;
      if (currentContinuous > 3600) {
        const extraMinutes = (currentContinuous - 3600) / 60;
        postureBalanceScore = Math.max(30, 100 - extraMinutes * 1.5);
      }
    }

    // Adjust for posture check-ins
    if (state.postureCheckIns.length > 0) {
      const slouches = state.postureCheckIns.filter(p => p.rating === 'slouching').length;
      const stiff = state.postureCheckIns.filter(p => p.rating === 'stiff').length;
      const penalty = (slouches * 10) + (stiff * 5);
      postureBalanceScore = Math.max(20, postureBalanceScore - penalty);
    }

    // 2. Stretch Compliance Score
    const expectedStretches = Math.max(1, Math.floor(elapsedHours * 1.5));
    const stretchRatio = Math.min(1.2, state.completedStretches.length / expectedStretches);
    const stretchComplianceScore = Math.min(100, Math.round(stretchRatio * 100));

    // 3. Hydration Score
    const expectedIntake = Math.max(250, Math.round(elapsedHours * 250)); // ~250ml per hour
    const hydrationRatio = Math.min(1.2, state.waterIntakeMl / expectedIntake);
    const hydrationScore = Math.min(100, Math.round(hydrationRatio * 100));

    // 4. Eye Rest Score (20-20-20 rule compliance)
    const expectedEyeBreaks = Math.max(1, Math.floor(elapsedHours * 3)); // every 20 mins
    const eyeRatio = Math.min(1.2, state.eyeBreaksCompleted / expectedEyeBreaks);
    const eyeRestScore = Math.min(100, Math.round(eyeRatio * 100));

    // Weighted Overall Score
    const weightedScore = Math.round(
      postureBalanceScore * 0.35 +
      stretchComplianceScore * 0.30 +
      eyeRestScore * 0.20 +
      hydrationScore * 0.15
    );

    const clampedScore = Math.max(0, Math.min(100, weightedScore));

    let tier: ErgonomicStrainScore['tier'] = 'optimal';
    let recommendation = 'Your ergonomics and movement patterns are in peak equilibrium!';
    let nextSuggestedAction = 'Continue your focused flow.';

    if (clampedScore >= 85) {
      tier = 'optimal';
      recommendation = 'Ergonomic equilibrium maintained. Great postural variability and eye rest rhythm.';
      nextSuggestedAction = 'Next micro-stretch scheduled in 25 minutes.';
    } else if (clampedScore >= 70) {
      tier = 'good';
      recommendation = 'Healthy baseline. Consider a quick 30-second shoulder roll or wrist extension.';
      nextSuggestedAction = 'Take a 20-20-20 ocular reset.';
    } else if (clampedScore >= 50) {
      tier = 'mild_strain';
      recommendation = 'Musculoskeletal fatigue accumulating from sustained static posture.';
      nextSuggestedAction = 'Perform the Seated Thoracic Spine Opener and sip water.';
    } else if (clampedScore >= 35) {
      tier = 'high_strain';
      recommendation = 'High postural strain detected! Significant uninterrupted sitting time.';
      nextSuggestedAction = 'Stand up immediately, perform hip flexor lunge & cervical chin tucks.';
    } else {
      tier = 'critical_fatigue';
      recommendation = 'Critical ergonomic overload. Extreme risk of cervical compression and eye strain.';
      nextSuggestedAction = 'Step away from your screen for a full 5-minute movement break.';
    }

    return {
      score: clampedScore,
      tier,
      factors: {
        postureBalanceScore: Math.round(postureBalanceScore),
        stretchComplianceScore: Math.round(stretchComplianceScore),
        hydrationScore: Math.round(hydrationScore),
        eyeRestScore: Math.round(eyeRestScore)
      },
      recommendation,
      nextSuggestedAction
    };
  }

  /**
   * Recommends the highest-priority stretch based on user check-in history and time
   */
  public static getRecommendedStretch(state: ErgonomicSessionState): MicroStretchRoutine {
    const lastCheck = state.postureCheckIns[state.postureCheckIns.length - 1];
    
    if (lastCheck?.rating === 'slouching') {
      return MICRO_STRETCH_CATALOG.find(s => s.id === 'neck-chin-tuck') || MICRO_STRETCH_CATALOG[0];
    }
    
    if (lastCheck?.rating === 'stiff') {
      return MICRO_STRETCH_CATALOG.find(s => s.id === 'thoracic-open-book') || MICRO_STRETCH_CATALOG[1];
    }

    if (state.currentPostureState === 'sitting' && (Date.now() - state.lastPostureStateChange) > 2700000) {
      return MICRO_STRETCH_CATALOG.find(s => s.id === 'standing-hip-flexor-lunge') || MICRO_STRETCH_CATALOG[3];
    }

    // Default rotation based on completed stretches count
    const index = state.completedStretches.length % MICRO_STRETCH_CATALOG.length;
    return MICRO_STRETCH_CATALOG[index];
  }
}
