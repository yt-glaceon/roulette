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
     * 除外リストを考慮してメンバーを選出
     * @param {Array} members - 全メンバーリスト
     * @param {number} count - 選出人数
     * @param {Array<string>} excludedIds - 除外するメンバーIDの配列
     * @returns {Array} 選出されたメンバー
     * @throws {Error} 選出可能なメンバーが不足している場合
     */
    selectMembersWithExclusion(members, count, excludedIds = []) {
        // 除外リストが空の場合は既存のメソッドを使用
        if (!excludedIds || excludedIds.length === 0) {
            return this.selectMembers(members, count);
        }

        // 除外IDに一致しないメンバーをフィルタリング
        const availableMembers = members.filter(member => !excludedIds.includes(member.id));

        // 選出可能なメンバー数のバリデーション
        if (availableMembers.length === 0) {
            throw {
                type: 'NO_AVAILABLE_MEMBERS',
                message: '選出可能なメンバーがいません。除外設定を確認してください。'
            };
        }

        if (count > availableMembers.length) {
            throw {
                type: 'INSUFFICIENT_MEMBERS',
                message: `選出人数が選出可能なメンバー数を超えています。選出可能: ${availableMembers.length}人`
            };
        }

        // 選出可能なメンバーから選出
        return this.selectMembers(availableMembers, count);
    }

    /**
     * 選出されたメンバーにロールをランダム割り当て
     * @param {Array} selectedMembers - 選出されたメンバー
     * @param {Array<string>} roles - ロールのリスト
     * @returns {Array} ロール付きメンバー情報 [{member, role}, ...]
     */
    assignRoles(selectedMembers, roles = []) {
        // 空文字列を除外したロールリストを作成
        const validRoles = roles.filter(role => role && role.trim() !== '');

        // ロールが空の場合は、すべてのメンバーに null を割り当て
        if (validRoles.length === 0) {
            return selectedMembers.map(member => ({
                member,
                role: null
            }));
        }

        // ロールリストをシャッフル
        const shuffledRoles = this.shuffle([...validRoles]);

        // 各メンバーにロールを割り当て
        return selectedMembers.map((member, index) => ({
            member,
            role: index < shuffledRoles.length ? shuffledRoles[index] : null
        }));
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
