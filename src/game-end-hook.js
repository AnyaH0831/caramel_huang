// reportGameEnd(score) will dispatch the custom event the leaderboard listens for
(function(){
    window.reportGameEnd = function(score) {
        try {
            const ev = new CustomEvent('treatgame:ended', { detail: { score: Number(score)||0 } });
            window.dispatchEvent(ev);
        } catch(e) { console.error('reportGameEnd error', e); }
    };

    // If the game defines a global endGame function, wrap it to also report score
    const existingEnd = window.endGame;
    if (typeof existingEnd === 'function') {
        window.endGame = function(...args) {
            try {
                existingEnd.apply(this, args);
            } finally {
                // if game stores final score in window.lastGameScore or similar, try common vars
                const s = (window.lastGameScore !== undefined) ? window.lastGameScore : (window.gameScore !== undefined ? window.gameScore : null);
                if (s !== null) reportGameEnd(s);
            }
        };
    }
})();
