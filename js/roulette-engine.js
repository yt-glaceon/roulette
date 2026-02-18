/**
 * ルーレットエンジン
 * メンバーのランダム選出ロジックを実装
 */
export class RouletteEngine {
    /**
     * メンバーリストから指定人数をランダムに選出
     * @param {Array} members - メンバーリスト
     * @param {number} count - 選出人数
     * @returns {Array} 選出されたメンバー
     * @throws {Error} 無効な選出人数の場合
     */
    selectMembers(members, count) {
        // バリデーション
        if (!this.validateCount(count, members.length)) {
            throw {
                type: 'INVALID_COUNT',
                message: `選出人数は 1 以上 ${members.length} 以下で指定してください。`
            };
        }

        if (members.length === 0) {
            throw {
                type: 'EMPTY_MEMBERS',
                message: 'メンバーがいません。'
            };
        }

        // メンバーリストをシャッフル
        const shuffled = this.shuffle([...members]);
        
        // 指定人数を選出
        return shuffled.slice(0, count);
    }

    /**
     * 選出人数のバリデーション
     * @param {number} count - 選出人数
     * @param {number} totalMembers - 総メンバー数
     * @returns {boolean} 有効かどうか
     */
    validateCount(count, totalMembers) {
        // 数値チェック
        if (typeof count !== 'number' || isNaN(count)) {
            return false;
        }

        // 整数チェック
        if (!Number.isInteger(count)) {
            return false;
        }

        // 範囲チェック
        if (count < 1 || count > totalMembers) {
            return false;
        }

        return true;
    }

    /**
     * Fisher-Yates シャッフルアルゴリズム
     * 配列をランダムにシャッフル（均等確率）
     * @param {Array} array - シャッフル対象の配列
     * @returns {Array} シャッフルされた配列
     */
    shuffle(array) {
        const result = [...array];
        
        for (let i = result.length - 1; i > 0; i--) {
            // 0 から i までのランダムなインデックスを生成
            const j = Math.floor(Math.random() * (i + 1));
            
            // 要素を交換
            [result[i], result[j]] = [result[j], result[i]];
        }
        
        return result;
    }
}
