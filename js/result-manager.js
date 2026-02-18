/**
 * 結果管理モジュール
 * クリップボードコピーと履歴管理を担当
 */
export class ResultManager {
    constructor() {
        this.historyKey = 'roulette_history';
        this.maxHistorySize = 50;
    }

    /**
     * 結果をクリップボードにコピー
     * @param {Array} selectedMembers - 選出されたメンバー
     * @returns {Promise<boolean>} 成功したかどうか
     */
    async copyToClipboard(selectedMembers) {
        try {
            // メンバー名をテキスト形式に変換
            const text = selectedMembers
                .map((member, index) => `${index + 1}. ${member.displayName}`)
                .join('\n');

            // Clipboard API を使用
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }

            // フォールバック: 古いブラウザ向け
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            return success;
        } catch (error) {
            console.error('[ResultManager] クリップボードコピーエラー:', error);
            return false;
        }
    }

    /**
     * ルーレット結果を履歴に保存
     * @param {Object} result - ルーレット結果
     */
    saveToHistory(result) {
        try {
            const history = this.getHistory();
            
            // 新しい結果を先頭に追加
            history.unshift({
                ...result,
                timestamp: Date.now()
            });

            // 最大サイズを超えた場合は古いものを削除
            if (history.length > this.maxHistorySize) {
                history.splice(this.maxHistorySize);
            }

            localStorage.setItem(this.historyKey, JSON.stringify(history));
        } catch (error) {
            console.error('[ResultManager] 履歴保存エラー:', error);
        }
    }

    /**
     * 履歴を取得
     * @returns {Array} 履歴リスト
     */
    getHistory() {
        try {
            const data = localStorage.getItem(this.historyKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('[ResultManager] 履歴取得エラー:', error);
            return [];
        }
    }

    /**
     * 履歴をクリア
     */
    clearHistory() {
        try {
            localStorage.removeItem(this.historyKey);
        } catch (error) {
            console.error('[ResultManager] 履歴クリアエラー:', error);
        }
    }

    /**
     * 特定の履歴を取得
     * @param {number} index - 履歴のインデックス
     * @returns {Object|null} 履歴データ
     */
    getHistoryItem(index) {
        const history = this.getHistory();
        return history[index] || null;
    }
}
