/**
 * Shared data path prefix resolver for multi-level navigation (root vs lab)
 */
const DATA_PATH_PREFIX = (function () {
    const path = window.location.pathname;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    if (isLocal) {
        if (path.includes('/lab/')) {
            return '../../orange-dev-data/';
        }
        return '../orange-dev-data/';
    }
    return 'https://raw.githubusercontent.com/bitcoindatalabs/orange-dev-data/main/';
})();

/**
 * Shared utility functions for Bitcoin Data Labs
 */

/**
 * Shared helper for consistent percentage formatting
 * @param {number} val - The numeric value
 * @param {number} precision - Number of decimal places
 * @param {boolean} isRatio - If true, multiplies by 100 (e.g. 0.15 -> 15%)
 */
function formatPct(val, precision = 0, isRatio = false) {
    const num = isRatio ? val * 100 : val;
    // Auto-precision: if value is small (<5%) and precision is 0, show 1 decimal
    const p = (num > 0 && num < 5 && precision === 0) ? 1 : precision;
    return num.toFixed(p) + '%';
}

/**
 * Formats large numbers into readable strings (e.g. 1.2k, 1.5M)
 * @param {number} num - The number to format
 * @param {number} precision - Decimal places (only applied if formatted as k/M)
 */
function formatCount(num, precision = 1) {
    if (num === null || num === undefined) return "-";
    if (Math.abs(num) >= 1000000) {
        return (num / 1000000).toFixed(precision).replace(/\.0$/, '') + "M";
    }
    if (Math.abs(num) >= 1000) {
        return (num / 1000).toFixed(precision).replace(/\.0$/, '') + "k";
    }
    return num.toLocaleString();
}
