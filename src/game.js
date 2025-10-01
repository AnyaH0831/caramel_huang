// Simple Treat Catcher MVP
// Simple Treat Catcher MVP - stable consolidated version
(() => {
    // Runtime error overlay helper - visible when uncaught exceptions happen during init
    function showRuntimeError(message) {
        let el = document.getElementById('gameRuntimeError');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gameRuntimeError';
            el.style.position = 'fixed';
            el.style.left = '12px';
            el.style.right = '12px';
            el.style.top = '12px';
            el.style.padding = '12px';
            el.style.background = 'rgba(255,200,200,0.98)';
            el.style.color = '#600';
            el.style.border = '2px solid #b00';
            el.style.zIndex = '99999';
            el.style.fontFamily = 'monospace';
            el.style.whiteSpace = 'pre-wrap';
            document.body.appendChild(el);
        }
        el.textContent = message;
    }

    try {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const highscoreEl = document.getElementById('highscore');
    let startBtn = document.getElementById('startBtn');
    let restartBtn = document.getElementById('restartBtn');

    // Game state
    let width = canvas.width;
    let height = canvas.height;
    let running = false;
    let last = performance.now();
    let player = { x: width / 2, y: height - 70, w: 140, h: 60, speed: 8 };
    let treats = [];
    let bowlPile = [];
    let floorPile = [];
    let maxTreats = 6;
    let spawnTimer = 0;
    // chocolate / special item state
    let chocolates = []; // {x,y,w,h,frameIndex}
    let score = 0;
    let highscore = 0;

    // Tunables
    const MIN_FLOOR_STACK_GAP_BASE = 12; // base px gap between bowl top and floor stack top (reduced)
    // floor spreading tunables
    const FLOOR_SPREAD_FORCE = 0.18; // small separation acceleration in px/frame (subtle)
    const FLOOR_SPREAD_DAMP = 0.86; // damping applied to per-item vx
    const FLOOR_JITTER = 0.6; // tiny random jitter applied occasionally to avoid perfect grid

    // debug flag (no UI button)
    let debugMode = false;

    try { highscore = parseInt(localStorage.getItem('treat_highscore')) || 0; } catch(e) { highscore = 0; }
    highscoreEl.textContent = highscore;

    // Defensive guards: if the canvas is missing, show a user-facing error and abort
    if (!canvas) {
        showRuntimeError('Required element #gameCanvas not found in the page. Make sure you opened src/game.html from the same folder.');
        return;
    }

    // If Start/Restart buttons are missing (unexpected), create simple fallbacks so the user can still run the game
    if (!startBtn) {
        startBtn = document.createElement('button');
        startBtn.id = 'startBtn';
        startBtn.textContent = 'Start Game';
        startBtn.style.position = 'fixed';
        startBtn.style.left = '12px';
        startBtn.style.bottom = '12px';
        document.body.appendChild(startBtn);
    }
    if (!restartBtn) {
        restartBtn = document.createElement('button');
        restartBtn.id = 'restartBtn';
        restartBtn.textContent = 'Restart';
        restartBtn.style.position = 'fixed';
        restartBtn.style.left = '120px';
        restartBtn.style.bottom = '12px';
        restartBtn.style.display = 'none';
        document.body.appendChild(restartBtn);
    }

    // Assets
    let chocolateImg = new Image(); chocolateImg.src = 'chocolate.png';
    let chocolateReady = false; let chocolateMask = null;
    chocolateImg.onload = () => { chocolateReady = true; try { chocolateMask = createAlphaMask(chocolateImg); } catch(e){ chocolateMask = null } };
    chocolateImg.onerror = () => { chocolateReady = false; console.warn('chocolate load fail'); };

    const treatFiles = ['dogTreats1.png','dogTreats2.png','dogTreats3.png','dogTreats4.png','dogTreats5.png','dogTreats6.png'];
    const treatFrames = [];
    const treatMasks = [];
    let framesLoaded = 0;
    let treatImgReady = false;
    const wideStretch = 1.6;

    treatFiles.forEach((p, idx) => {
        const img = new Image(); img.src = p;
        img.onload = () => { treatFrames[idx] = img; try { treatMasks[idx] = createAlphaMask(img); } catch(e){ treatMasks[idx]=null } framesLoaded++; if (framesLoaded === treatFiles.length) treatImgReady = true; };
        img.onerror = () => { framesLoaded++; console.warn('treat load fail', p); if (framesLoaded === treatFiles.length) treatImgReady = treatFrames.some(Boolean); };
    });

    let bowlImg = new Image(); bowlImg.src = 'foodBowl.png';
    let bowlReady = false; let bowlMask = null;
    bowlImg.onload = () => { bowlReady = true; try { bowlMask = createAlphaMask(bowlImg); } catch(e){ bowlMask = null } };
    bowlImg.onerror = () => { bowlReady = false; console.warn('bowl load fail'); };
    const bowlWidthScale = 1.2, bowlHeightScale = 1.9;

    // Helpers: create mask, pixelOverlap, findOverlapContactPixel
    function createAlphaMask(img) {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const cx = c.getContext('2d'); cx.clearRect(0,0,c.width,c.height); cx.drawImage(img,0,0);
        const data = cx.getImageData(0,0,c.width,c.height).data;
        const alpha = new Uint8ClampedArray(c.width * c.height);
        for (let i=0;i<c.width*c.height;i++) alpha[i] = data[i*4+3];
        return { w: c.width, h: c.height, alpha };
    }

    function pixelOverlap(maskA, ax, ay, aw, ah, maskB, bx, by, bw, bh) {
        if (!maskA || !maskB) return false;
        const aLeft = ax - aw/2, aTop = ay - ah/2, aRight = aLeft+aw, aBottom = aTop+ah;
        const bLeft = bx - bw/2, bTop = by - bh/2, bRight = bLeft+bw, bBottom = bTop+bh;
        const left = Math.max(aLeft,bLeft)|0, top = Math.max(aTop,bTop)|0, right = Math.min(aRight,bRight)|0, bottom = Math.min(aBottom,bBottom)|0;
        if (right<=left || bottom<=top) return false;
        const axs = maskA.w/aw, ays = maskA.h/ah, bxs = maskB.w/bw, bys = maskB.h/bh;
        const thr = 10;
        for (let py=top; py<bottom; py++) {
            for (let px=left; px<right; px++) {
                const aX = Math.floor((px - aLeft)*axs), aY = Math.floor((py - aTop)*ays);
                const bX = Math.floor((px - bLeft)*bxs), bY = Math.floor((py - bTop)*bys);
                const aIdx = aY*maskA.w + aX, bIdx = bY*maskB.w + bX;
                if (maskA.alpha[aIdx] > thr && maskB.alpha[bIdx] > thr) return true;
            }
        }
        return false;
    }

    function findOverlapContactPixel(maskA, ax, ay, aw, ah, maskB, bx, by, bw, bh) {
        if (!maskA || !maskB) return null;
        const aLeft = ax - aw/2, aTop = ay - ah/2, aRight = aLeft+aw, aBottom = aTop+ah;
        const bLeft = bx - bw/2, bTop = by - bh/2, bRight = bLeft+bw, bBottom = bTop+bh;
        const left = Math.max(aLeft,bLeft)|0, top = Math.max(aTop,bTop)|0, right = Math.min(aRight,bRight)|0, bottom = Math.min(aBottom,bBottom)|0;
        if (right<=left || bottom<=top) return null;
        const axs = maskA.w/aw, ays = maskA.h/ah, bxs = maskB.w/bw, bys = maskB.h/bh;
        const thr = 10;
        for (let py=top; py<bottom; py++) {
            for (let px=left; px<right; px++) {
                const aX = Math.floor((px - aLeft)*axs), aY = Math.floor((py - aTop)*ays);
                const bX = Math.floor((px - bLeft)*bxs), bY = Math.floor((py - bTop)*bys);
                const aIdx = aY*maskA.w + aX, bIdx = bY*maskB.w + bX;
                if (maskA.alpha[aIdx] > thr && maskB.alpha[bIdx] > thr) return { canvasX: px+0.5, canvasY: py+0.5, aSrcX: aX, aSrcY: aY, bSrcX: bX, bSrcY: bY };
            }
        }
        return null;
    }

    // Probe downward and small horizontal shifts to find a supporting overlap
    // Returns {dxAdjust, yAdjust} in canvas pixels to apply to the computed center placement
    function findSupportingOffset(frameMask, centerX, centerY, tw, th, supportList, maxDown=20, maxSide=10) {
        // supportList: array of objects with {mask, cx, cy, w, h} (cx,cy are centers in canvas coords)
        // Try from 0..maxDown, and for each Y try offsets prioritized as 0, ±1, ±2... up to maxSide
        const stepY = 2;
        // build prioritized horizontal offsets so we prefer no horizontal shift first
        const sxOrder = [0];
        for (let s = 1; s <= maxSide; s++) { sxOrder.push(s); sxOrder.push(-s); }
        for (let dy = 0; dy <= maxDown; dy += stepY) {
            for (let k = 0; k < sxOrder.length; k++) {
                const sx = sxOrder[k];
                const testCx = centerX + sx;
                const testCy = centerY + dy;
                // check each support candidate
                for (let s=0;s<supportList.length;s++) {
                    const sup = supportList[s];
                    if (!frameMask || !sup.mask) {
                        // fallback to simple AABB bottom touching
                        const aLeft = testCx - tw/2, aTop = testCy - th/2, aRight = aLeft + tw, aBottom = aTop + th;
                        const bLeft = sup.cx - sup.w/2, bTop = sup.cy - sup.h/2, bRight = bLeft + sup.w, bBottom = bTop + sup.h;
                        // require overlap at least 1 px vertically (aBottom >= bTop)
                        if (aBottom >= bTop && aTop < bBottom && !(aRight < bLeft || aLeft > bRight)) return { dxAdjust: sx, yAdjust: dy };
                    } else {
                        // precise mask overlap
                        if (pixelOverlap(frameMask, testCx, testCy, tw, th, sup.mask, sup.cx, sup.cy, sup.w, sup.h)) return { dxAdjust: sx, yAdjust: dy };
                    }
                }
            }
        }
        return null;
    }

    // Place a treat onto the floor but stack it intelligently with small animation
    function placeTreatOnFloor(t) {
        // base horizontal clamp
        const clampedX = Math.max(t.w/2, Math.min(width - t.w/2, t.x));
        // find nearby floor items whose horizontal distance overlaps
        const nearby = [];
        for (let i=0;i<floorPile.length;i++) {
            const f = floorPile[i];
            if (Math.abs(f.x - clampedX) <= Math.max(f.w, t.w)) nearby.push(f);
        }
        let destY;
        if (nearby.length === 0) {
            destY = height - t.h/2 - 6;
        } else {
            // compute the smallest top among nearby items and stack above it
            let minTop = Infinity;
            for (let i=0;i<nearby.length;i++) minTop = Math.min(minTop, nearby[i].y - nearby[i].h/2);
            destY = Math.max(Math.round(t.h/2)+4, minTop - Math.round(t.h*0.9));
        }
    // Build supports for a more precise mask-based probe (include bowl and existing floorPile)
    const supports = [];
    // compute bowl geometry locally so this helper is safe to call outside update()
    const localBowlW = bowlReady ? Math.round(player.w*bowlWidthScale) : player.w;
    const localBowlH = bowlReady ? Math.round(player.h*bowlHeightScale) : player.h;
    const localPlayerTop = player.y - localBowlH/2;
    if (bowlMask) supports.push({ mask: bowlMask, cx: player.x, cy: localPlayerTop + localBowlH/2, w: localBowlW, h: localBowlH });
        for (let i=0;i<floorPile.length;i++) {
            const f = floorPile[i];
            const fmask = (f.frameIndex>=0)?treatMasks[f.frameIndex]:null;
            supports.push({ mask: fmask, cx: f.x, cy: f.y, w: f.w, h: f.h });
        }
    const support = findSupportingOffset((t.frameIndex>=0)?treatMasks[t.frameIndex]:null, clampedX, destY, t.w, t.h, supports, 18, 8);
        let finalX = clampedX, finalY = destY;
        if (support) { finalX = clampedX + support.dxAdjust; finalY = destY + support.yAdjust; }
        // Prevent stacking that would go above the bowl top: enforce a minimum gap (so floor stacks stay lower)
        const bowlTopLimit = player.y - (bowlReady ? Math.round(player.h*bowlHeightScale) : player.h) / 2;
    const minStackGap = MIN_FLOOR_STACK_GAP_BASE + Math.round((bowlReady ? Math.round(player.h*bowlHeightScale) : player.h) * 0.06); // px
        const finalTop = finalY - t.h/2;
        if (finalTop < bowlTopLimit + minStackGap) {
            // scatter: place on floor with slight random horizontal offset (no stacking)
            const scatterX = clampedX + (Math.random()-0.5) * Math.min(60, t.w*2);
            const floorY = height - t.h/2 - 6;
            const startY = floorY - Math.min(16, Math.round(t.h * 0.25));
            floorPile.push({ x: Math.max(t.w/2, Math.min(width - t.w/2, scatterX)), y: floorY, currentY: startY, w: t.w, h: t.h, frameIndex: t.frameIndex, anim: true });
            return;
        }
        // animate into place from slightly above
        const startY = finalY - Math.min(16, Math.round(t.h * 0.25));
        floorPile.push({ x: finalX, y: finalY, currentY: startY, w: t.w, h: t.h, frameIndex: t.frameIndex, anim: true });
    }

    // End game helper (triggered when chocolate is collected)
    let gameEnded = false;
    function endGame(reason) {
        if (gameEnded) return;
        gameEnded = true;
        running = false;
        // show overlay (semantic DOM + classes so CSS can style it consistently with the site)
        let ov = document.getElementById('gameEndOverlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'gameEndOverlay';
            ov.className = 'game-end-overlay';
            document.body.appendChild(ov);
        }
        ov.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'game-end-card';
        const title = document.createElement('h2');
        title.className = 'game-end-title';
        const body = document.createElement('div'); body.className = 'game-end-body';
        if (reason === 'chocolate') {
            title.textContent = "Oh no — chocolate!";
            body.textContent = 'Dogs can\'t eat chocolate. You lost.';
        } else {
            title.textContent = 'Game Over';
            body.textContent = '';
        }
        // score on its own line
        const scoreLine = document.createElement('div');
        scoreLine.className = 'game-end-score';
        scoreLine.textContent = 'Score: ' + score;
        const btn = document.createElement('button');
        btn.textContent = 'Play again';
        // reuse the site-wide button style so it visually matches other buttons
        btn.className = 'refresh-btn';
        btn.addEventListener('click', ()=>{ ov.remove(); startGame(); });
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(scoreLine);
    card.appendChild(btn);
    ov.appendChild(card);
        // persist highscore
        try { if (score > highscore) { localStorage.setItem('treat_highscore', String(score)); highscore = score; highscoreEl.textContent = highscore; } } catch(e){}
    }

    // Spawn
    function spawnTreat() {
        if (treats.length >= maxTreats) return;
        const baseSize = Math.random() < 0.12 ? 32 : 22;
        const size = Math.round(baseSize * 1.6);
        const frameIndex = (treatFrames.length>0) ? Math.floor(Math.random()*treatFrames.length) : -1;
        const sx = (frameIndex===4||frameIndex===5) ? wideStretch : 1.0;
        const w = Math.round(size * sx), h = size;
        const x = Math.random()*(width - w) + w/2;
        const speed = 1.2 + Math.random()*1.6;
        treats.push({ x, y: -h, w, h, r: size/2, speed, frameIndex });
        // small chance to spawn a special chocolate instead (increase frequency)
        if (Math.random() < 0.08) {
            const cw = Math.round(size * 1.2), ch = Math.round(size * 1.2);
            chocolates.push({ x, y: -ch, w: cw, h: ch, frameIndex: -1, speed: speed*1.2 });
        }
    }

    // Reset and start the game consistently
    function startGame() {
        // reset state
        running = true;
        gameEnded = false;
        treats = [];
        bowlPile = [];
        floorPile = [];
        chocolates = [];
    score = 0; scoreEl.textContent = score;
        spawnTimer = 120;
        last = performance.now();
        startBtn.style.display = 'none';
        restartBtn.style.display = 'none';
        // start loop
        requestAnimationFrame(loop);
    }

    // Update
    function update(dt) {
        if (!running) return;
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawnTreat(); spawnTimer = 400 + Math.random()*400; }

    const bowlW = bowlReady ? Math.round(player.w*bowlWidthScale) : player.w;
    const bowlH = bowlReady ? Math.round(player.h*bowlHeightScale) : player.h;
        const playerLeft = player.x - bowlW/2, playerTop = player.y - bowlH/2, playerRight = playerLeft + bowlW;

    // compute bowl movement delta this frame (for nudging floor treats)
    if (typeof update._lastPlayerX === 'undefined') update._lastPlayerX = player.x;
    const bowlDeltaX = player.x - update._lastPlayerX;
    update._lastPlayerX = player.x;

        for (let i = treats.length-1; i>=0; i--) {
            const t = treats[i];
            const dy = t.speed * (dt/16);
            const nextY = t.y + dy;
            const tw = t.w, th = t.h;

            // If the falling treat's top passes below the bowl bottom, scatter it to the floor immediately
            const tTopNext = nextY - th/2;
            const bowlBottom = playerTop + bowlH/2;
            if (tTopNext > bowlBottom) { treats.splice(i,1); placeTreatOnFloor(t); continue; }

            // AABB vs bowl
            const tLeft = t.x - tw/2, tRight = t.x + tw/2, tTop = t.y - th/2, tBottom = t.y + th/2;
            let overlap = !(tRight < playerLeft || tLeft > playerRight || tBottom < playerTop || tTop > playerTop + bowlH);
            const frameMask = (t.frameIndex>=0)?treatMasks[t.frameIndex]:null;
            if (overlap && bowlMask && frameMask) {
                if (!pixelOverlap(frameMask, t.x, t.y, tw, th, bowlMask, player.x, player.y, bowlW, bowlH)) overlap = false;
            }
            if (overlap) {
                // place into bowl pile
                const padding = 6; const bowlLeft = playerLeft + padding, bowlRight = playerRight - padding;
                // reduce horizontal scatter so treats tend to fall nearer the bowl center
                const destX = Math.max(bowlLeft + tw/2, Math.min(bowlRight - tw/2, player.x + (Math.random()-0.5)*(tw*0.08)));
                const bowlMid = playerTop + bowlH/2; const baseY = bowlMid - th/2;
                // pileLift controls how high items start stacking; lower slightly so stacks sit a bit lower
                const pileLift = Math.round(bowlH*0.09);
                const stackIndex = bowlPile.length;
                // reduce lateral stacking offset so columns stay tighter
                const stackOffset = Math.floor(stackIndex / Math.max(1, Math.floor((bowlRight - bowlLeft)/Math.max(1,tw)))) * (th*0.25);
                const destY = Math.max(Math.round(th/2)+4, baseY - stackOffset - pileLift);
                // allow placement slightly closer to the top of the canvas/bowl
                const ceilingMargin = 2;
                    if (destY <= ceilingMargin + Math.round(th/2) + 2) {
                        treats.splice(i,1); placeTreatOnFloor(t);
                    } else {
                        // create animated pile entry: start slightly above target and ease into place; final position slightly overlaps
                        // tighter stacking: smaller overlap and slide values
                        const overlapAmt = Math.min(2, Math.round(th * 0.05));
                        const slideDown = Math.min(2, Math.round(th * 0.03)); // tiny extra settle
                                // Probe for a supporting pixel under the proposed placement
                                const proposedCenterX = destX;
                                const proposedCenterY = destY;
                                const supports = [];
                                // include bowl as support
                                if (bowlMask) supports.push({ mask: bowlMask, cx: player.x, cy: playerTop + bowlH/2, w: bowlW, h: bowlH });
                                // include existing pile items
                                for (let pi2=0; pi2<bowlPile.length; pi2++) {
                                    const pp = bowlPile[pi2];
                                    const pcx = player.x + (('currentDX' in pp)?pp.currentDX:pp.dx);
                                    const pcy = playerTop + (('currentLocalY' in pp)?pp.currentLocalY:pp.localY);
                                    const pmask = (pp.frameIndex>=0)?treatMasks[pp.frameIndex]:null;
                                    supports.push({ mask: pmask, cx: pcx, cy: pcy, w: pp.w, h: pp.h });
                                }
                                const support = findSupportingOffset((t.frameIndex>=0)?treatMasks[t.frameIndex]:null, proposedCenterX, proposedCenterY, t.w, t.h, supports, 18, 8);
                                if (!support) {
                                    // give up and drop to floor
                                    treats.splice(i,1); placeTreatOnFloor(t);
                                } else {
                                    const finalCenterX = proposedCenterX + support.dxAdjust;
                                    const finalCenterY = proposedCenterY + support.yAdjust;
                                    // slight extra downward nudge so placed items sit a bit lower in the bowl
                                    const pileLowerNudge = Math.min(6, Math.round(th * 0.06));
                                    const targetLocalY = finalCenterY - playerTop + overlapAmt + slideDown + pileLowerNudge;
                                    const startLocalY = targetLocalY - 12;
                                    const targetDX = finalCenterX - player.x;
                                    const startDX = t.x - player.x;
                                    treats.splice(i,1);
                                    bowlPile.push({ dx: targetDX, targetDX: targetDX, currentDX: startDX, localY: targetLocalY, currentLocalY: startLocalY, w: t.w, h: t.h, frameIndex: t.frameIndex, anim: true });
                                }
                    }
                score += (t.r > 12) ? 5 : 1; scoreEl.textContent = score; continue;
            }

            // Swept AABB vs pile
            let attached = false;
            for (let pi=0; pi<bowlPile.length; pi++) {
                const p = bowlPile[pi];
                const px = player.x + (('currentDX' in p) ? p.currentDX : p.dx);
                const py = playerTop + (('currentLocalY' in p) ? p.currentLocalY : p.localY);
                const pw = p.w, ph = p.h;
                const pileLeft = px - pw/2, pileRight = px + pw/2, pileTop = py - ph/2, pileBottom = py + ph/2;
                const tLeftNext = t.x - tw/2, tRightNext = t.x + tw/2, tTopNext = nextY - th/2, tBottomNext = nextY + th/2;
                if (!(tRightNext < pileLeft || tLeftNext > pileRight || tBottomNext < pileTop || tTopNext > pileBottom)) {
                    // gravity rule: only attach if the falling treat is approaching from above
                    // require treat center to be above pile center (simple gravity heuristic)
                    if (!(t.y < py)) continue; // skip this pile - side contact only

                    const pMask = (p.frameIndex>=0)?treatMasks[p.frameIndex]:null;
                    const frameMask2 = (t.frameIndex>=0)?treatMasks[t.frameIndex]:null;
                    let contact = null;
                    if (pMask && frameMask2) contact = findOverlapContactPixel(frameMask2, t.x, nextY, tw, th, pMask, px, py, pw, ph);
                    const pixelOk = (pMask && frameMask2) ? !!contact : true;
                    if (pixelOk) {
                        // If we have an exact pixel contact, enforce that it represents a top-on-top contact
                        if (contact && pMask && frameMask2) {
                            const aNormY = contact.aSrcY / frameMask2.h; // 0..1 from top to bottom
                            const bNormY = contact.bSrcY / pMask.h;
                            // require overlapping pixel to be in lower part of falling treat
                            // and in the very top portion of the piled treat (top 12%) — ensure top-of-treat contact
                            if (!(aNormY >= 0.6 && bNormY <= 0.12)) {
                                // treat is likely grazing side or hitting lower portion — don't attach
                                continue;
                            }
                        }
                        if (contact) {
                            // compute center placement so the treat's mask aligns at contact
                            const centerX = contact.canvasX - (contact.aSrcX + 0.5) * (tw / frameMask2.w) + tw/2;
                            const centerY = contact.canvasY - (contact.aSrcY + 0.5) * (th / frameMask2.h) + th/2;
                            const clampedY = Math.max(Math.round(th/2)+4, Math.min(Math.round(centerY), height - Math.round(th/2) - 4));
                            // allow placement slightly closer to the top
                            const ceilingMargin = 2;
                            if (clampedY <= ceilingMargin + Math.round(th/2) + 2) {
                                treats.splice(i,1); placeTreatOnFloor(t);
                            } else {
                                // tighter stacking for contact-based placement
                                const overlapAmt = Math.min(2, Math.round(th * 0.05));
                                const slideDown = Math.min(2, Math.round(th * 0.03));
                                // Probe for supporting overlap (include bowl and pile)
                                const proposedCenterX2 = centerX;
                                const proposedCenterY2 = clampedY;
                                const supports2 = [];
                                if (bowlMask) supports2.push({ mask: bowlMask, cx: player.x, cy: playerTop + bowlH/2, w: bowlW, h: bowlH });
                                for (let pi2=0; pi2<bowlPile.length; pi2++) {
                                    const pp = bowlPile[pi2];
                                    const pcx = player.x + (('currentDX' in pp)?pp.currentDX:pp.dx);
                                    const pcy = playerTop + (('currentLocalY' in pp)?pp.currentLocalY:pp.localY);
                                    const pmask = (pp.frameIndex>=0)?treatMasks[pp.frameIndex]:null;
                                    supports2.push({ mask: pmask, cx: pcx, cy: pcy, w: pp.w, h: pp.h });
                                }
                                const support2 = findSupportingOffset((t.frameIndex>=0)?treatMasks[t.frameIndex]:null, proposedCenterX2, proposedCenterY2, t.w, t.h, supports2, 18, 8);
                                if (!support2) {
                                    treats.splice(i,1); placeTreatOnFloor(t);
                                } else {
                                    const finalCenterX2 = proposedCenterX2 + support2.dxAdjust;
                                    const finalCenterY2 = proposedCenterY2 + support2.yAdjust;
                                    const pileLowerNudge = Math.min(6, Math.round(th * 0.06));
                                    const targetLocalY = finalCenterY2 - playerTop + overlapAmt + slideDown + pileLowerNudge;
                                    const startLocalY = targetLocalY - 12;
                                    const targetDX = finalCenterX2 - player.x;
                                    const startDX = t.x - player.x;
                                    treats.splice(i,1);
                                    bowlPile.push({ dx: targetDX, targetDX: targetDX, currentDX: startDX, localY: targetLocalY, currentLocalY: startLocalY, w: t.w, h: t.h, frameIndex: t.frameIndex, anim: true });
                                }
                            }
                        } else {
                            // fallback: rest on top of pile top
                            let destY = pileTop - Math.round(th*0.9);
                            destY = Math.max(Math.round(th/2)+4, Math.min(destY, height - Math.round(th/2) - 4));
                            // allow placement slightly closer to the top
                            const ceilingMargin = 2;
                            if (destY <= ceilingMargin + Math.round(th/2) + 2) {
                                treats.splice(i,1); placeTreatOnFloor(t);
                            } else {
                                // tighter stacking for fallback placement
                                const overlapAmt = Math.min(2, Math.round(th * 0.05));
                                const slideDown = Math.min(2, Math.round(th * 0.03));
                                const proposedCenterX3 = t.x;
                                const proposedCenterY3 = destY;
                                const supports3 = [];
                                if (bowlMask) supports3.push({ mask: bowlMask, cx: player.x, cy: playerTop + bowlH/2, w: bowlW, h: bowlH });
                                for (let pi2=0; pi2<bowlPile.length; pi2++) {
                                    const pp = bowlPile[pi2];
                                    const pcx = player.x + (('currentDX' in pp)?pp.currentDX:pp.dx);
                                    const pcy = playerTop + (('currentLocalY' in pp)?pp.currentLocalY:pp.localY);
                                    const pmask = (pp.frameIndex>=0)?treatMasks[pp.frameIndex]:null;
                                    supports3.push({ mask: pmask, cx: pcx, cy: pcy, w: pp.w, h: pp.h });
                                }
                                const support3 = findSupportingOffset((t.frameIndex>=0)?treatMasks[t.frameIndex]:null, proposedCenterX3, proposedCenterY3, t.w, t.h, supports3, 18, 8);
                                if (!support3) {
                                    treats.splice(i,1); placeTreatOnFloor(t);
                                } else {
                                    const finalCenterX3 = proposedCenterX3 + support3.dxAdjust;
                                    const finalCenterY3 = proposedCenterY3 + support3.yAdjust;
                                    const pileLowerNudge = Math.min(6, Math.round(th * 0.06));
                                    const targetLocalY = finalCenterY3 - playerTop + overlapAmt + slideDown + pileLowerNudge;
                                    const startLocalY = targetLocalY - 12;
                                    const targetDX = finalCenterX3 - player.x;
                                    const startDX = t.x - player.x;
                                    treats.splice(i,1);
                                    bowlPile.push({ dx: targetDX, targetDX: targetDX, currentDX: startDX, localY: targetLocalY, currentLocalY: startLocalY, w: t.w, h: t.h, frameIndex: t.frameIndex, anim: true });
                                }
                            }
                        }
                        score += (t.r>12)?5:1; scoreEl.textContent = score; attached = true; break;
                    }
                }
            }
            if (attached) continue;

            // fall to next
            if (nextY - th/2 > height) { treats.splice(i,1); placeTreatOnFloor(t); }
            else t.y = nextY;
        }

        // Update chocolates (special items)
        for (let ci = chocolates.length-1; ci >= 0; ci--) {
            const c = chocolates[ci];
            c.y += c.speed * (dt/16);
            // if below screen, remove
            if (c.y - c.h/2 > height) { chocolates.splice(ci,1); continue; }
            // detect collision with bowl (AABB then mask if available)
            const cw = c.w, ch = c.h;
            const cLeft = c.x - cw/2, cRight = c.x + cw/2, cTop = c.y - ch/2, cBottom = c.y + ch/2;
            if (!(cRight < playerLeft || cLeft > playerRight || cBottom < playerTop || cTop > playerTop + bowlH)) {
                // overlap; if masks exist, check pixelOverlap using chocolateMask if available
                const useMask = (bowlMask && chocolateMask);
                let collide = true;
                if (useMask) {
                    collide = pixelOverlap(chocolateMask, c.x, c.y, cw, ch, bowlMask, player.x, player.y, bowlW, bowlH);
                }
                if (collide) {
                    chocolates.splice(ci,1);
                    endGame('chocolate');
                    break;
                }
            }
        }

        // Animate bowlPile entries (ease into place)
        for (let pi = 0; pi < bowlPile.length; pi++) {
            const p = bowlPile[pi];
            if (!('currentLocalY' in p)) p.currentLocalY = p.localY;
            if (p.anim) {
                // ease currentLocalY -> localY (vertical snap)
                const diffY = p.localY - p.currentLocalY;
                const stepY = Math.sign(diffY) * Math.max(0.5, Math.abs(diffY) * 0.18);
                p.currentLocalY += stepY;
                // ease currentDX -> targetDX (horizontal slide toward bowl center)
                if (!('currentDX' in p)) p.currentDX = ('dx' in p) ? p.dx : 0;
                if (!('targetDX' in p)) p.targetDX = ('dx' in p) ? p.dx : p.currentDX;
                const diffX = p.targetDX - p.currentDX;
                const stepX = Math.sign(diffX) * Math.max(0.3, Math.abs(diffX) * 0.2);
                p.currentDX += stepX;
                // small downward easing extra to reinforce gravity (already baked into targetLocalY)
                // stop anim when close on both axes
                if (Math.abs(p.localY - p.currentLocalY) < 0.5 && Math.abs(p.targetDX - p.currentDX) < 0.5) {
                    p.currentLocalY = p.localY; p.currentDX = p.targetDX; p.anim = false;
                }
            }
        }
        // Animate floorPile entries (ease into place)
        for (let fi = 0; fi < floorPile.length; fi++) {
            const f = floorPile[fi];
            if (!('currentY' in f)) f.currentY = f.y;
            if (f.anim) {
                const diff = f.y - f.currentY;
                const step = Math.sign(diff) * Math.max(0.5, Math.abs(diff) * 0.18);
                f.currentY += step;
                if (Math.abs(f.y - f.currentY) < 0.5) { f.currentY = f.y; f.anim = false; }
            }
            // Initialize vx if missing
            if (!('vx' in f)) f.vx = 0;
            // Gentle spreading when bowl isn't nudging strongly: apply tiny separation between neighbors
            const isBowlNudging = Math.abs(bowlDeltaX) > 0.0001;
            const bowlLeftNow = player.x - bowlW/2, bowlRightNow = player.x + bowlW/2;
            const overlapsBowl = !(f.x + f.w/2 < bowlLeftNow || f.x - f.w/2 > bowlRightNow);
            if (!isBowlNudging || !overlapsBowl) {
                // compute a small separation force from nearby floor items
                for (let fj = 0; fj < floorPile.length; fj++) {
                    if (fj === fi) continue;
                    const other = floorPile[fj];
                    const dx = f.x - other.x;
                    const dist = Math.abs(dx);
                    const wantSep = (f.w + other.w) * 0.45; // desired spacing
                    if (dist > 0 && dist < wantSep) {
                        const push = (wantSep - dist) * 0.02; // scale small
                        f.vx += (dx / dist) * push;
                    }
                }
                // tiny random jitter so clusters don't lock perfectly
                if (Math.random() < 0.02) f.vx += (Math.random() - 0.5) * FLOOR_JITTER;
            }
            // If the bowl moved into a floor treat this frame, nudge the floor treat horizontally
            if (Math.abs(bowlDeltaX) > 0.0001) {
                const nudgeFactor = 0.25; // small fraction of bowl movement
                const nudged = bowlDeltaX * nudgeFactor;
                const bowlLeftNow = player.x - bowlW/2, bowlRightNow = player.x + bowlW/2;
                // If floor item overlaps bowl horizontally, shift it by a small fraction of the bowlDeltaX but keep on floor
                if (!(f.x + f.w/2 < bowlLeftNow || f.x - f.w/2 > bowlRightNow)) {
                    // apply slight damping to reduce jitter
                    f.x += nudged * 0.85;
                    // clamp inside bounds
                    f.x = Math.max(f.w/2, Math.min(width - f.w/2, f.x));
                }
            }
            // apply velocity and damping
            if (Math.abs(f.vx) > 0.0001) {
                f.x += f.vx;
                f.vx *= FLOOR_SPREAD_DAMP;
                // clamp inside bounds
                f.x = Math.max(f.w/2, Math.min(width - f.w/2, f.x));
                // if vx is very small, zero it to avoid micro-jitter
                if (Math.abs(f.vx) < 0.03) f.vx = 0;
            }
        }
    }

    // compute canvas background color from CSS variable so game uses site theme
    let canvasBgColor = null;
    try {
        const cs = getComputedStyle(canvas);
        canvasBgColor = cs.backgroundColor || cs.getPropertyValue('--panel') || 'rgb(255,243,198)';
    } catch(e) { canvasBgColor = 'rgb(255,243,198)'; }

    // Draw
    function draw() {
        ctx.clearRect(0,0,width,height);
        // draw floor (match canvas background)
        ctx.fillStyle = canvasBgColor; ctx.fillRect(0, height-40, width, 40);
        // floorPile
        floorPile.forEach(f => {
            const fy = ('currentY' in f) ? f.currentY : f.y;
            if (treatImgReady && f.frameIndex>=0 && treatFrames[f.frameIndex]) ctx.drawImage(treatFrames[f.frameIndex], f.x - f.w/2, fy - f.h/2, f.w, f.h);
            else { ctx.fillStyle='#c28'; ctx.fillRect(f.x - f.w/2, fy - f.h/2, f.w, f.h); }
        });
        // chocolates (draw on top of floor but below active treats)
        chocolates.forEach(c => {
            if (chocolateReady && chocolateImg) {
                ctx.drawImage(chocolateImg, c.x - c.w/2, c.y - c.h/2, c.w, c.h);
            } else if (treatImgReady && c.frameIndex>=0 && treatFrames[c.frameIndex]) {
                ctx.drawImage(treatFrames[c.frameIndex], c.x - c.w/2, c.y - c.h/2, c.w, c.h);
            } else { ctx.fillStyle='#5b2'; ctx.beginPath(); ctx.rect(c.x - c.w/2, c.y - c.h/2, c.w, c.h); ctx.fill(); ctx.fillStyle='#000'; ctx.fillText('🍫', c.x-6, c.y+6); }
        });
        // bowl (draw bowl first so pile can render in front of it)
        const playerLeft = player.x - (bowlReady?Math.round(player.w*bowlWidthScale):player.w)/2;
        const playerTop = player.y - (bowlReady?Math.round(player.h*bowlHeightScale):player.h)/2;
        if (bowlReady) {
            const bw = Math.round(player.w*bowlWidthScale), bh = Math.round(player.h*bowlHeightScale);
            ctx.drawImage(bowlImg, player.x - bw/2, player.y - bh/2, bw, bh);
        }
        // bowlPile (render piled items in front of bowl), sorted by localY (small to large)
        const sorted = bowlPile.slice().sort((a,b)=>a.localY - b.localY);
        sorted.forEach(p => {
            const px = player.x + (('currentDX' in p) ? p.currentDX : p.dx);
            const py = playerTop + (('currentLocalY' in p) ? p.currentLocalY : p.localY);
            if (treatImgReady && p.frameIndex>=0 && treatFrames[p.frameIndex]) ctx.drawImage(treatFrames[p.frameIndex], px - p.w/2, py - p.h/2, p.w, p.h);
            else { ctx.fillStyle='#f5d'; ctx.fillRect(px - p.w/2, py - p.h/2, p.w, p.h); }
        });
        // draw active treats on top
        treats.forEach(t => drawTreat(t));
    // HUD is shown in the external HTML controls; canvas overlay HUD removed
        if (debugMode) {
            ctx.fillStyle='rgba(255,0,0,0.2)'; // debug overlay can be expanded
        }
    }

    function drawTreat(t) {
        if (t.frameIndex>=0 && treatImgReady && treatFrames[t.frameIndex]) ctx.drawImage(treatFrames[t.frameIndex], t.x - t.w/2, t.y - t.h/2, t.w, t.h);
        else { ctx.fillStyle='#ffec71'; ctx.beginPath(); ctx.arc(t.x, t.y, t.h/2, 0, Math.PI*2); ctx.fill(); }
    }

    function loop(now) { const dt = now - last; last = now; update(dt); draw(); if (running) requestAnimationFrame(loop); }

    // Input handlers
    let keys = {};
    window.addEventListener('keydown', e => { keys[e.key]=true; if (e.key==='d') { debugMode = !debugMode; } });
    window.addEventListener('keyup', e => { keys[e.key]=false; });
    function handleInput() { if (keys['ArrowLeft']||keys['a']) player.x -= player.speed; if (keys['ArrowRight']||keys['d']) player.x += player.speed; requestAnimationFrame(handleInput); }
    requestAnimationFrame(handleInput);

    // Touch/mouse
    let dragging=false;
    canvas.addEventListener('mousedown', e=>dragging=true);
    window.addEventListener('mouseup', e=>dragging=false);
    window.addEventListener('mousemove', e=>{ if (!dragging) return; const rect=canvas.getBoundingClientRect(); const x=(e.clientX-rect.left)*(canvas.width/rect.width); player.x=x; });
    canvas.addEventListener('touchstart', e=>{ e.preventDefault(); const t=e.touches[0]; const rect=canvas.getBoundingClientRect(); const x=(t.clientX-rect.left)*(canvas.width/rect.width); player.x=x; }, {passive:false});
    canvas.addEventListener('touchmove', e=>{ e.preventDefault(); const t=e.touches[0]; const rect=canvas.getBoundingClientRect(); const x=(t.clientX-rect.left)*(canvas.width/rect.width); player.x=x; }, {passive:false});

    // Buttons
    startBtn.addEventListener('click', ()=>{ if (running) return; startGame(); });
    restartBtn.addEventListener('click', ()=>{ startGame(); });

    // Resize
    function fitCanvasToDisplaySize() { const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio||1; const displayWidth = Math.min(rect.width,900); canvas.width = Math.round(displayWidth * dpr); canvas.height = Math.round((displayWidth*0.65)*dpr); width=canvas.width; height=canvas.height; player.y = height - 60 * dpr; player.w = Math.round(140 * dpr); player.h = Math.round(60 * dpr); }
    window.addEventListener('resize', fitCanvasToDisplaySize); setTimeout(fitCanvasToDisplaySize, 50);
    } catch (err) {
        try {
            showRuntimeError('Game initialization error:\n' + (err && err.stack ? err.stack : String(err)));
            console.error('Game init error', err);
        } catch (displayErr) {
            console.error('Failed to display runtime error', displayErr, err);
        }
    }
})();
