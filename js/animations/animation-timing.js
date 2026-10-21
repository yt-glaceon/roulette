/**
 * アニメーションの時間配分・停止位置の計算(純粋関数のみ、DOM に触れない)
 */

/**
 * easeOutCubic イージング
 * @param {number} p - 進み(0〜1)
 * @returns {number} 1 - (1 - p)^3
 */
export function easeOutCubic(p) {
    return 1 - Math.pow(1 - p, 3);
}

/**
 * 減速する切り替え時刻の配列を作る
 * j 番目(1 始まり、全 M 回)の間隔の形は
 * g(j) = minInterval + (maxInterval - minInterval) * (j / M)^2。
 * 時刻 t_j = g(1) + ... + g(j) を、最後の t_M がちょうど duration になるよう
 * 全体に同じ係数を掛けて合わせる。最初の切り替えは t=0 ではなく1つ目の間隔のあと。
 * @param {number} duration - 最後の切り替え時刻(ms)
 * @param {Object} options
 * @param {number} options.minInterval - 最短の間隔(ms)
 * @param {number} options.maxInterval - 最長の間隔(ms)
 * @param {number} [options.steps] - 切り替え回数。省略時は係数が1に最も近くなる回数
 * @returns {number[]} 切り替え時刻の配列(長さ = 切り替え回数)
 */
export function buildDecelSchedule(duration, { minInterval, maxInterval, steps } = {}) {
    // M 回の間隔の形(係数を掛ける前)を返す
    const rawIntervals = (m) => {
        const list = [];
        for (let j = 1; j <= m; j++) {
            list.push(minInterval + (maxInterval - minInterval) * Math.pow(j / m, 2));
        }
        return list;
    };
    const sum = (list) => list.reduce((a, b) => a + b, 0);

    let count;
    if (Number.isInteger(steps) && steps >= 1) {
        count = steps;
    } else {
        // 係数を掛ける前の t_M が duration に最も近くなる M を選ぶ(1 以上)
        const upper = Math.max(1, Math.ceil(duration / Math.max(minInterval, 1)) + 1);
        count = 1;
        let bestDiff = Math.abs(sum(rawIntervals(1)) - duration);
        for (let m = 2; m <= upper; m++) {
            const diff = Math.abs(sum(rawIntervals(m)) - duration);
            if (diff < bestDiff) {
                bestDiff = diff;
                count = m;
            }
        }
    }

    const intervals = rawIntervals(count);
    const total = sum(intervals);
    const scale = total > 0 ? duration / total : 0;

    const times = [];
    let acc = 0;
    for (let j = 0; j < count; j++) {
        acc += intervals[j] * scale;
        times.push(acc);
    }
    // 浮動小数点の誤差で最後がずれないようにする
    times[count - 1] = duration;
    return times;
}

/**
 * 区画内の停止位置を 0〜1 の比率で返す
 * @param {Function} random - 0 以上 1 未満の乱数を返す関数
 * @param {number} margin - 区画の両端で避ける比率
 * @returns {number} margin + random() * (1 - 2 * margin)
 */
export function pickOffsetInSection(random, margin) {
    return margin + random() * (1 - 2 * margin);
}
