// Leaderboard module for TreatCatcher
(function(){
    const KEY = 'treat_leaderboard_v1';
    const USER_KEY = 'treat_leaderboard_users_v1';
    const MAX = 10;
    let lastGameScore = null; // last score sent by game

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return [];
            return JSON.parse(raw);
        } catch(e) { return []; }
    }
    function save(list) {
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch(e) { console.error('Could not save leaderboard', e); }
    }

    function isHighScore(list, score) {
        if (!list || list.length < MAX) return true;
        return score > list[list.length-1].score;
    }

    function addScore(name, score) {
        const list = load();
        const cleanName = name || 'Anon';
        const newScore = Number(score) || 0;
        // find existing best for this player
        const existingBest = getUserBest(cleanName);
        if (existingBest === null) {
            // no previous entry for player: add
            const entry = { name: cleanName, score: newScore, ts: Date.now() };
            list.push(entry);
        } else {
            // player exists: only replace if new score is higher than previous best
            if (newScore > existingBest) {
                // remove all existing entries for this player, then add the new one
                const filtered = list.filter(e => e.name !== cleanName);
                filtered.push({ name: cleanName, score: newScore, ts: Date.now() });
                // replace list reference
                while (list.length) list.pop();
                filtered.forEach(it => list.push(it));
            } else {
                // new score not higher: do nothing
                return render();
            }
        }
        list.sort((a,b)=>b.score - a.score || a.ts - b.ts);
        while (list.length > MAX) list.pop();
        save(list);
        render();
    }

    // return user's best score currently in leaderboard (or null)
    function getUserBest(name) {
        if (!name) return null;
        const list = load();
        const userEntries = list.filter(e => e.name === name);
        if (!userEntries || userEntries.length === 0) return null;
        return Math.max(...userEntries.map(e => Number(e.score) || 0));
    }

    // Try to read the game's displayed high score from the DOM (e.g. <span id="highscore">)
    function getDisplayedHighScore() {
        try {
            const el = document.getElementById('highscore');
            if (!el) return null;
            const raw = (el.textContent || el.innerText || '').trim();
            if (!raw) return null;
            // strip non-numeric chars
            const num = Number(raw.replace(/[^0-9.-]+/g, ''));
            if (!Number.isFinite(num)) return null;
            return num;
        } catch(e) { return null; }
    }

    // --- User management (simple client-side password hashes) ---
    function loadUsers() {
        try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); } catch(e){ return {}; }
    }
    function saveUsers(u) { try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch(e){} }

    async function sha256Hex(text) {
        const enc = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest('SHA-256', enc);
        const hex = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
        return hex;
    }

    async function setUserPassword(name, password) {
        const users = loadUsers();
        const hash = await sha256Hex(password + '::' + name);
        users[name] = { hash, created: Date.now() };
        saveUsers(users);
    }

    async function verifyUserPassword(name, password) {
        const users = loadUsers();
        if (!users[name]) return false;
        const hash = await sha256Hex(password + '::' + name);
        return users[name].hash === hash;
    }

    function clearScores() { save([]); render(); }

    // UI
    const root = document.getElementById('leaderboard-root');
    if (!root) return;

    function render() {
        const list = load();
        root.innerHTML = '';
        const container = document.createElement('div');
        container.style.display = 'inline-block';
        container.style.textAlign = 'left';
        container.style.background = 'rgba(255,255,255,0.95)';
        container.style.padding = '12px';
        container.style.borderRadius = '10px';
        container.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
        container.style.minWidth = '260px';

        const title = document.createElement('div');
        title.style.fontWeight = '700';
        title.style.marginBottom = '8px';
        title.textContent = 'Leaderboard (Top ' + MAX + ')';
        container.appendChild(title);

        const listEl = document.createElement('ol');
        listEl.style.paddingLeft = '18px';
        listEl.style.margin = '0 0 8px 0';
        list.slice(0,MAX).forEach(entry => {
            const li = document.createElement('li');
            li.textContent = `${entry.name} — ${entry.score}`;
            listEl.appendChild(li);
        });
        if (list.length === 0) {
            const p = document.createElement('div'); p.textContent = 'No scores yet. Play to add your name!'; p.style.opacity = '0.8'; p.style.marginBottom = '8px'; container.appendChild(p);
        }
        container.appendChild(listEl);

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '8px';
        controls.style.justifyContent = 'flex-end';

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add Score';
        addBtn.className = 'refresh-btn';
        addBtn.addEventListener('click', async () => {
            try {
                // determine the best score to offer: prefer the displayed game-high (if present),
                // otherwise fall back to lastGameScore and the stored personal best
                const inputName = prompt('Enter name for leaderboard:', 'Player');
                if (!inputName) return;
                let displayed = getDisplayedHighScore();
                let offeredScore = null;
                if (displayed !== null) offeredScore = displayed;
                else if (lastGameScore !== null) offeredScore = Number(lastGameScore) || 0;
                if (!inputName) return;
                const storedBest = getUserBest(inputName);
                if (storedBest !== null) {
                    if (offeredScore === null) offeredScore = storedBest;
                    else offeredScore = Math.max(offeredScore, storedBest);
                }
                // allow user to confirm or override the offered score
                const scoreStr = prompt('Score to add (highest local score is prefilled):', String(offeredScore !== null ? offeredScore : 0));
                if (scoreStr === null) return;
                const score = Number(scoreStr) || 0;
                const users = loadUsers();
                if (users[inputName]) {
                    const pw = prompt('Name exists — enter password to sign in:');
                    if (!pw) return;
                    const ok = await verifyUserPassword(inputName, pw);
                    if (!ok) return alert('Wrong password');
                    addScore(inputName, score);
                } else {
                    // create new user and set password
                    const pw = prompt('New name — set a password (will be stored locally):');
                    if (pw === null) return;
                    await setUserPassword(inputName, pw || '');
                    addScore(inputName, score);
                }
            } catch(e) { console.error(e); alert('Failed to add score'); }
        });
        controls.appendChild(addBtn);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.className = 'refresh-btn';
        clearBtn.addEventListener('click', ()=>{ if (confirm('Clear all leaderboard scores?')) clearScores(); });
        controls.appendChild(clearBtn);

        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export';
        exportBtn.className = 'refresh-btn';
        exportBtn.addEventListener('click', ()=>{ const data = JSON.stringify(load(),null,2); const w = window.open('about:blank'); w.document.write('<pre>'+data+'</pre>'); });
        controls.appendChild(exportBtn);

        container.appendChild(controls);
        root.appendChild(container);
    }

    // Public API: try adding by custom event or global function
    window.leaderboardAddScore = async function(score){
        try {
            lastGameScore = Number(score) || 0;
            const list = load();
            // when invoked programmatically, prefer the displayed game high score if present,
            // otherwise prefer user's local best or the final game score
            const name = prompt('Enter your name to add score (will use the game High if available):', 'Player');
            if (!name) return;
            const users = loadUsers();
            const storedBest = getUserBest(name);
            const displayed = getDisplayedHighScore();
            let offered;
            if (displayed !== null) offered = displayed;
            else {
                offered = lastGameScore || 0;
                if (storedBest !== null) offered = Math.max(offered, storedBest);
            }
            // confirm/add
            if (users[name]) {
                const pw = prompt('Name exists — enter password to sign in:');
                if (!pw) return alert('Cancelled');
                const ok = await verifyUserPassword(name, pw);
                if (!ok) return alert('Wrong password');
                addScore(name, offered);
            } else {
                const pw = prompt('New name — set a password (will be stored locally):');
                if (pw === null) return;
                await setUserPassword(name, pw || '');
                addScore(name, offered);
            }
            // notify if not a global high score
            if (!isHighScore(list, offered)) {
                alert('Score: ' + offered + '\nNot a top ' + MAX + ' score, but saved as your local best.');
            }
        } catch(e){ console.error(e); }
    };

    // Listen for a custom event dispatched by the game on end
    window.addEventListener('treatgame:ended', (ev) => {
        const finalScore = ev && ev.detail && ev.detail.score;
        if (typeof finalScore === 'number') {
            lastGameScore = finalScore;
            // Offer quick prompt to add score if high
            window.leaderboardAddScore(finalScore);
        }
    });

    render();
})();
