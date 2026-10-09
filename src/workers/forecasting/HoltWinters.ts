/**
 * HoltWinters.ts
 * Implementation of the Holt-Winters triple exponential smoothing algorithm for time-series forecasting.
 * Accounts for level, trend, and daily seasonality in venue occupancy data.
 */

export interface HoltWintersParams {
    alpha: number; // Level smoothing (0-1)
    beta: number;  // Trend smoothing (0-1)
    gamma: number; // Seasonality smoothing (0-1)
    seasonLength: number; // Number of periods in a season (e.g., 24 for hourly daily data)
    seasonalType?: 'multiplicative' | 'additive';
}

export interface ForecastResult {
    predictions: number[];
    finalLevel: number;
    finalTrend: number;
    finalSeasonals: number[];
}

const EPSILON = 1e-6;

export class HoltWinters {
    private params: HoltWintersParams;

    constructor(params: HoltWintersParams) {
        this.params = params;
    }

    /**
     * Fits the model to historical data and forecasts future periods.
     * @param data Historical time-series data points.
     * @param forecastHorizon Number of future periods to predict.
     */
    public fitAndForecast(data: number[], forecastHorizon: number): ForecastResult {
        const { alpha, beta, gamma, seasonLength } = this.params;
        const n = data.length;

        if (n < seasonLength * 2) {
            throw new Error('Insufficient data for seasonality detection. Need at least 2 full seasons.');
        }

        // Detect if the historical series is largely zero-valued to choose additive fallback
        const zeroCount = data.filter((v) => v === 0).length;
        const isPredominantlyZero = zeroCount / n > 0.5;
        const seasonalType =
            this.params.seasonalType ?? (isPredominantlyZero ? 'additive' : 'multiplicative');

        // Initialize level, trend, and seasonal components
        let level = this.calculateInitialLevel(data, seasonLength);
        let trend = this.calculateInitialTrend(data, seasonLength);
        const seasonals = this.calculateInitialSeasonals(
            data,
            seasonLength,
            level,
            trend,
            seasonalType
        );

        // Smoothing phase
        for (let t = seasonLength; t < n; t++) {
            const prevLevel = level;
            const seasonalIndex = t % seasonLength;

            if (seasonalType === 'additive') {
                // Additive formulation
                level = alpha * (data[t] - seasonals[seasonalIndex]) + (1 - alpha) * (prevLevel + trend);
                trend = beta * (level - prevLevel) + (1 - beta) * trend;
                seasonals[seasonalIndex] =
                    gamma * (data[t] - level) + (1 - gamma) * seasonals[seasonalIndex];
            } else {
                // Multiplicative formulation with EPSILON smoothing against zero divisors
                const safeSeasonal = Math.abs(seasonals[seasonalIndex]) < EPSILON ? EPSILON : seasonals[seasonalIndex];
                level = alpha * (data[t] / safeSeasonal) + (1 - alpha) * (prevLevel + trend);
                trend = beta * (level - prevLevel) + (1 - beta) * trend;

                const safeLevel = Math.abs(level) < EPSILON ? EPSILON : level;
                seasonals[seasonalIndex] =
                    gamma * (data[t] / safeLevel) + (1 - gamma) * seasonals[seasonalIndex];
            }
        }

        // Forecasting phase
        const predictions: number[] = [];
        for (let h = 1; h <= forecastHorizon; h++) {
            const seasonalIndex = (n + h - 1) % seasonLength;
            const rawForecast =
                seasonalType === 'additive'
                    ? level + h * trend + seasonals[seasonalIndex]
                    : (level + h * trend) * seasonals[seasonalIndex];

            const forecast = Number.isFinite(rawForecast) ? rawForecast : 0;
            predictions.push(Math.max(0, Math.min(100, forecast))); // Clamp to 0-100% occupancy
        }

        return {
            predictions,
            finalLevel: Number.isFinite(level) ? level : 0,
            finalTrend: Number.isFinite(trend) ? trend : 0,
            finalSeasonals: [...seasonals]
        };
    }

    private calculateInitialLevel(data: number[], seasonLength: number): number {
        let sum = 0;
        for (let i = 0; i < seasonLength; i++) {
            sum += data[i];
        }
        return sum / seasonLength;
    }

    private calculateInitialTrend(data: number[], seasonLength: number): number {
        let sum1 = 0;
        let sum2 = 0;
        for (let i = 0; i < seasonLength; i++) {
            sum1 += data[seasonLength + i];
            sum2 += data[i];
        }
        return (sum1 - sum2) / (seasonLength * seasonLength);
    }

    private calculateInitialSeasonals(
        data: number[],
        seasonLength: number,
        initialLevel: number,
        initialTrend: number,
        seasonalType: 'multiplicative' | 'additive'
    ): number[] {
        const seasonals = new Array(seasonLength).fill(0);
        for (let i = 0; i < seasonLength; i++) {
            const baseline = initialLevel + (i + 1) * initialTrend;
            if (seasonalType === 'additive') {
                seasonals[i] = data[i] - baseline;
            } else {
                const safeBaseline = Math.abs(baseline) < EPSILON ? EPSILON : baseline;
                seasonals[i] = data[i] / safeBaseline;
            }
        }
        return seasonals;
    }
}
