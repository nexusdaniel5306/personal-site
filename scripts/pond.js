// Original procedural artwork: koi silhouettes sampled onto a shared ASCII grid.
(() => {
    const canvas = document.getElementById('pond-canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const toggle = document.getElementById('pond-toggle');
    const podButton = document.getElementById('pond-pod');
    const hint = document.getElementById('pond-hint');
    const intro = document.querySelector('.home-intro');
    const navigation = document.querySelector('.home-header nav');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const koi = [
        { phase: 0.2, speed: 0.065, size: 1, color: [238, 99, 24] },
        { phase: 2.5, speed: -0.055, size: 0.84, color: [242, 195, 38], markingInk: '#896619' },
        { phase: 4.6, speed: 0.045, size: 0.72, color: [226, 77, 22] },
        { phase: 3.8, speed: 0.06, size: 0.64, color: [238, 99, 24] },
        { phase: 5.6, speed: -0.05, size: 0.9, color: [244, 133, 28] }
    ];
    koi.forEach((fish, index) => {
        fish.angle = fish.phase;
        fish.stroke = fish.phase;
        fish.nextWake = 2 + index * 2.5;
        fish.nextDash = 12 + index * 11;
        fish.dashStart = -10;
        fish.burst = 0;
        fish.offsetX = 0;
        fish.offsetY = 0;
        fish.heading = null;
        fish.reaction = null;
    });
    const ripples = [];
    const lilyPads = [
        { x: 0.13, y: 0.23, size: 1, angle: 0.6, phase: 0 },
        { x: 0.88, y: 0.3, size: 0.82, angle: 2.4, phase: 2 },
        { x: 0.68, y: 0.86, size: 1.08, angle: -1.2, phase: 4 }
    ];
    const lotusPod = [
        '    hhhhh    ',
        '  hhOhhhOhh  ',
        ' hmmmmmmmmmh ',
        'hmmOmmOmmOmmh',
        ' hhmmmmmmmhh ',
        '  bdddddddb  ',
        '   bddddb    ',
        '     ds      ',
        '      s      ',
        '      ss     ',
        '       s     '
    ];
    const podPalette = {
        h: [[183, 188, 112], '#e1dfad', ':'],
        m: [[159, 170, 85], '#cbd09a', ';'],
        O: [[78, 95, 46], '#e0dba3', 'o'],
        b: [[137, 150, 77], '#c4ca91', '/'],
        d: [[111, 130, 65], '#9fac70', '|'],
        s: [[123, 143, 85], '#c0ca95', ':']
    };
    const glyphs = ':;t%SX8#@';
    let width = 0;
    let height = 0;
    // Keep the same ASCII detail at every viewport width.
    const cell = 6;
    let time = 0;
    let frame = 0;
    let last = 0;
    let visible = true;
    let paused = motion.matches;
    let textBounds;
    let podShakeStart = -10;

    function podShake() {
        const age = time - podShakeStart;
        return age < 1.6 ? Math.sin(age * 24) * Math.exp(-age * 2.6) : 0;
    }

    function podPose() {
        const size = Math.min(64, width * 0.09, height * 0.1);
        return {
            x: width * lilyPads[1].x - size * 0.1 + Math.sin(time * 0.23 + 2) * 2 + podShake() * 5,
            y: height * lilyPads[1].y - size * 1.1 + Math.sin(time * 0.3 + 2) * 2,
            angle: -0.12 + Math.sin(time * 0.23 + 2) * 0.025 + podShake() * 0.22
        };
    }

    function measureText() {
        const paragraphs = Array.from(intro.querySelectorAll('p'), paragraph => paragraph.getBoundingClientRect());
        const left = Math.min(...paragraphs.map(rect => rect.left));
        const right = Math.max(...paragraphs.map(rect => rect.right));
        const top = paragraphs[0].top;
        const bottom = paragraphs[paragraphs.length - 1].bottom;
        // The photo and name are open water; only the prose and navigation reserve space.
        textBounds = [{ left, right, top, bottom, width: right - left, height: bottom - top }, navigation.getBoundingClientRect()];
    }

    function drawWater() {
        ctx.fillStyle = 'rgba(99, 124, 113, 0.16)';
        for (let y = cell; y < height; y += cell * 1.5) {
            for (let x = cell / 2; x < width; x += cell) {
                const wave = Math.sin(x * 0.024 + time * 0.5) * Math.cos(y * 0.044 - time * 0.3);
                if (wave > 0.79) ctx.fillText('·', x, y);
            }
        }
    }

    function bodyHalfWidth(s) {
        if (s < 0 || s > 0.82) return 0;
        if (s < 0.25) return 0.17 * Math.sqrt(1 - Math.pow((s - 0.25) / 0.25, 2));
        return 0.022 + 0.148 * Math.pow(Math.max(0, 1 - (s - 0.25) / 0.53), 1.4);
    }

    function drawLilyPads() {
        ctx.save();
        ctx.globalAlpha = 0.85;
        const stepY = cell * 1.5;
        for (const pad of lilyPads) {
            const shake = pad === lilyPads[1] ? podShake() : 0;
            const radius = Math.min(64, width * 0.09, height * 0.1) * pad.size;
            const x = width * pad.x + Math.sin(time * 0.22 + pad.phase) * 3 + shake * 4;
            const y = height * pad.y + Math.sin(time * 0.3 + pad.phase) * 2;
            const angle = pad.angle + Math.sin(time * 0.18 + pad.phase) * 0.04 + shake * 0.12;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const reach = radius * 1.3;
            const firstRow = Math.max(0, Math.floor((y - reach) / stepY));
            const firstCol = Math.max(0, Math.floor((x - reach) / cell));
            for (let row = firstRow; row * stepY < Math.min(height, y + reach); row++) {
                for (let col = firstCol; col * cell < Math.min(width, x + reach); col++) {
                    const px = (col + 0.5) * cell;
                    const py = (row + 0.5) * stepY;
                    const dx = (px - x) / radius;
                    const dy = (py - y) / (radius * 0.92);
                    const u = dx * cos + dy * sin;
                    const v = -dx * sin + dy * cos;
                    // A rounded leaf and a deep triangular notch read clearly on the ASCII grid.
                    const edge = Math.pow(Math.abs(u), 2.2) + Math.pow(Math.abs(v), 2.2);
                    if (edge > 1 || (u > -0.08 && Math.abs(v) < (u + 0.08) * 0.46)) continue;

                    const radial = Math.atan2(v, u);
                    const vein = Math.abs(Math.sin(radial * 4)) < 0.12 && Math.hypot(u, v) > 0.15;
                    const shimmer = Math.sin(time * 0.55 + u * 2 + v * 3 + pad.phase) * 0.07;
                    const light = Math.max(0, Math.min(1, 0.6 - dx * 0.18 - dy * 0.2 + shimmer - (edge > 0.8 ? 0.17 : 0)));
                    const red = Math.round(55 + light * 69);
                    const green = Math.round(93 + light * 66);
                    const blue = Math.round(47 + light * 37);
                    ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
                    ctx.fillRect(col * cell, row * stepY, cell, stepY);
                    ctx.fillStyle = 'rgba(235, 241, 188, 0.16)';
                    ctx.fillRect(col * cell, row * stepY, cell - 1, 1);
                    ctx.fillStyle = vein ? '#c4d59a' : '#34572e';
                    const glyph = vein ? '+' : glyphs[Math.min(8, Math.floor((1 - light) * 8))];
                    ctx.fillText(glyph, px, py);
                }
            }
        }
        ctx.restore();
    }

    function drawLotus() {
        const size = Math.min(64, width * 0.09, height * 0.1);
        const stepY = cell * 1.5;
        // Sample the flower on the same grid as the leaves and fish.
        function tiles(x, y, sample) {
            const plantSize = size * 0.67;
            for (let row = Math.max(0, Math.floor((y - plantSize * 1.3) / stepY)); row * stepY < Math.min(height, y + plantSize * 1.4); row++) {
                for (let col = Math.max(0, Math.floor((x - plantSize * 1.3) / cell)); col * cell < Math.min(width, x + plantSize * 1.3); col++) {
                    const px = (col + 0.5) * cell;
                    const py = (row + 0.5) * stepY;
                    const tile = sample((px - x) / plantSize, (py - y) / plantSize);
                    if (!tile) continue;
                    ctx.fillStyle = tile[0];
                    ctx.fillRect(col * cell, row * stepY, cell, stepY);
                    ctx.fillStyle = tile[1];
                    ctx.fillText(tile[2], px, py);
                }
            }
        }

        ctx.save();
        ctx.globalAlpha = 0.92;
        const flowerX = width * lilyPads[0].x - size * 0.55 + Math.sin(time * 0.22) * 3;
        const flowerY = height * lilyPads[0].y - size * 0.55 + Math.sin(time * 0.3) * 2;
        const turn = -Math.PI / 2 + Math.sin(time * 0.2) * 0.035;
        const petals = [];
        for (let layer = 0; layer < 2; layer++) {
            const count = layer ? 6 : 8;
            for (let i = 0; i < count; i++) {
                const angle = i * Math.PI * 2 / count + layer * Math.PI / 8 + turn;
                petals.push({ cos: Math.cos(angle), sin: Math.sin(angle), length: layer ? 0.75 : 1.12, width: layer ? 0.28 : 0.34, layer });
            }
        }
        tiles(flowerX, flowerY, (u, v) => {
            v /= 0.86;
            let tile;
            for (const petal of petals) {
                const along = u * petal.cos + v * petal.sin;
                const across = -u * petal.sin + v * petal.cos;
                const t = (along + 0.12) / petal.length;
                if (t <= 0 || t >= 1) continue;
                const half = petal.width * Math.pow(Math.sin(Math.PI * t), 0.85);
                if (Math.abs(across) > half) continue;
                const rim = Math.abs(across) / half;
                const light = Math.max(0, Math.min(1, 0.3 + Math.sin(Math.PI * t) * 0.52 + petal.layer * 0.16 - rim * 0.4 + Math.sin(time * 0.45 + u - v) * 0.035));
                tile = [`rgb(${Math.round(205 + light * 49)}, ${Math.round(78 + light * 147)}, ${Math.round(124 + light * 114)})`, rim > 0.75 ? '#ad527b' : '#fbe3e9', rim > 0.75 ? ':' : t > 0.65 ? '/' : '%'];
            }
            if (Math.hypot(u, v) < 0.19) return ['#dfb85d', '#fff0b1', '@'];
            return tile;
        });

        const pod = podPose();
        podButton.style.left = `${pod.x}px`;
        podButton.style.top = `${pod.y + size * 0.05}px`;
        podButton.style.width = `${Math.max(44, size * 0.95)}px`;
        podButton.style.height = `${Math.max(44, size * 1.1)}px`;
        // A fixed local grid preserves all five holes and the stem at every viewport size.
        const podCell = size * 0.8 / lotusPod[0].length;
        const podStepY = podCell * 1.35;
        ctx.translate(pod.x, pod.y);
        ctx.rotate(pod.angle);
        ctx.font = `bold ${podCell * 1.3}px "Courier New", monospace`;
        for (let row = 0; row < lotusPod.length; row++) {
            for (let col = 0; col < lotusPod[row].length; col++) {
                const kind = lotusPod[row][col];
                if (kind === ' ') continue;
                const [color, ink, glyph] = podPalette[kind];
                const light = Math.round((6 - col) * 1.2 + Math.sin(time * 0.45 + row * 0.3) * 4);
                const x = (col - 6.5) * podCell;
                const y = (row - 4.5) * podStepY;
                ctx.fillStyle = `rgb(${color.map(channel => channel + light).join(',')})`;
                ctx.fillRect(x, y, podCell, podStepY);
                ctx.fillStyle = ink;
                ctx.fillText(glyph, x + podCell / 2, y + podStepY / 2);
            }
        }
        ctx.restore();
    }

    function orbitPose(fish, index) {
        const angle = fish.angle;
        const length = Math.min(210, width * 0.3, height * 0.3) * fish.size;
        const bounds = textBounds[0];
        const centerY = Math.max(length, Math.min(height - length, (bounds.top + bounds.bottom) / 2));
        // Rounded orbits leave room around the actual text block, with a different lane per koi.
        const radiusX = Math.min(width / 2 - length * 0.55 - 12, bounds.width / 2 + length * 0.55 + 40 + index * 8);
        const radiusY = Math.max(0, Math.min(centerY - length * 0.55 - 12, height - centerY - length * 0.55 - 12, bounds.height / 2 + length * 0.4 + 30 + index * 7));
        const u = Math.cos(angle);
        const v = Math.sin(angle);
        const x = width / 2 + Math.sign(u) * Math.pow(Math.abs(u), 0.65) * radiusX;
        const y = centerY + Math.sign(v) * Math.pow(Math.abs(v), 0.65) * radiusY;
        const heading = Math.atan2(
            radiusY * u * Math.pow(Math.max(0.01, Math.abs(v)), -0.35) * fish.speed,
            -radiusX * v * Math.pow(Math.max(0.01, Math.abs(u)), -0.35) * fish.speed
        );
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        return { x, y, cos, sin, length };
    }

    function fishPose(fish, index) {
        const pose = orbitPose(fish, index);
        return {
            ...pose,
            x: pose.x + fish.offsetX,
            y: pose.y + fish.offsetY,
            cos: fish.heading === null ? pose.cos : Math.cos(fish.heading),
            sin: fish.heading === null ? pose.sin : Math.sin(fish.heading)
        };
    }

    function addRipple(x, y, kind, cos = 0, sin = 0) {
        if (ripples.length >= 16) ripples.shift();
        ripples.push({ x, y, time, kind, cos, sin });
    }

    function attractToPod(x, y) {
        koi.slice(0, width < 600 ? 3 : 5).forEach((fish, index) => {
            const pose = fishPose(fish, index);
            const distance = Math.hypot(pose.x - x, pose.y - y);
            if (distance > 320) return;
            const margin = pose.length * 0.55;
            const standOff = Math.min(distance * 0.4, 65 + pose.length * 0.35);
            const targetX = x + Math.cos(fish.phase) * standOff;
            const targetY = y + Math.sin(fish.phase) * standOff * 0.8;
            fish.reaction = {
                x: Math.max(margin, Math.min(width - margin, targetX)),
                y: Math.max(margin, Math.min(height - margin, targetY)),
                until: time + 6
            };
            fish.heading = Math.atan2(pose.sin, pose.cos);
        });
    }

    function updateFish(dt) {
        koi.slice(0, width < 600 ? 3 : 5).forEach((fish, index) => {
            const previous = fishPose(fish, index);
            if (fish.reaction && time >= fish.reaction.until) fish.reaction = null;
            const dash = time >= fish.nextDash && !fish.reaction;
            if (dash) {
                fish.dashStart = time;
                fish.nextDash = time + 55 + Math.random() * 30;
            }
            const progress = (time - fish.dashStart) / 1.8;
            fish.burst = progress < 1 ? Math.pow(Math.sin(Math.PI * progress), 2) : 0;
            fish.angle += dt * fish.speed * (1 + fish.burst * 2.4);
            fish.stroke += dt * (3.2 + fish.burst * 5);
            const orbit = orbitPose(fish, index);
            const reaction = fish.reaction;
            const response = 1 - Math.exp(-dt * 0.8);
            fish.offsetX += ((reaction ? reaction.x - orbit.x : 0) - fish.offsetX) * response;
            fish.offsetY += ((reaction ? reaction.y - orbit.y : 0) - fish.offsetY) * response;
            const margin = orbit.length * 0.55;
            fish.offsetX = Math.max(margin, Math.min(width - margin, orbit.x + fish.offsetX)) - orbit.x;
            fish.offsetY = Math.max(margin, Math.min(height - margin, orbit.y + fish.offsetY)) - orbit.y;
            if (reaction || Math.hypot(fish.offsetX, fish.offsetY) > 0.5) {
                const heading = Math.atan2(orbit.y + fish.offsetY - previous.y, orbit.x + fish.offsetX - previous.x);
                const current = fish.heading ?? Math.atan2(previous.sin, previous.cos);
                const turn = Math.atan2(Math.sin(heading - current), Math.cos(heading - current));
                fish.heading = current + Math.max(-dt * 4, Math.min(dt * 4, turn));
            } else {
                fish.offsetX = 0;
                fish.offsetY = 0;
                fish.heading = null;
            }
            if (dash || time >= fish.nextWake) {
                const pose = fishPose(fish, index);
                addRipple(pose.x - pose.cos * pose.length * 0.6, pose.y - pose.sin * pose.length * 0.6, dash ? 'dash' : 'wake', pose.cos, pose.sin);
                fish.nextWake = time + 8 + Math.random() * 8;
            }
        });
    }

    function drawKoi(fish, index) {
        const { x, y, cos, sin, length } = fishPose(fish, index);
        const reach = length * 0.8;
        const stepY = cell * 1.5;
        const columns = Math.ceil(width / cell);
        const eyes = new Set([-1, 1].map(side => {
            const eyeAcross = side * bodyHalfWidth(0.1) * length * 0.72;
            const eyeX = x + length * 0.4 * cos - eyeAcross * sin;
            const eyeY = y + length * 0.4 * sin + eyeAcross * cos;
            return Math.floor(eyeX / cell) + Math.floor(eyeY / stepY) * columns;
        }));
        const flutter = 1 + Math.sin(fish.stroke * 0.75) * 0.1;

        // Sample in world coordinates so every fish shares the same text grid.
        for (let gy = Math.max(0, Math.floor((y - reach) / stepY)); gy * stepY < Math.min(height, y + reach); gy++) {
            for (let gx = Math.max(0, Math.floor((x - reach) / cell)); gx * cell < Math.min(width, x + reach); gx++) {
                const px = gx * cell + cell / 2;
                const py = gy * stepY + stepY / 2;
                const dx = px - x;
                const dy = py - y;
                const along = dx * cos + dy * sin;
                const s = 0.5 - along / length; // Nose = 0, tail = 1.
                if (s < 0 || s > 1.12) continue;
                const bend = Math.sin(fish.stroke - s * 5) * length * (0.045 + fish.burst * 0.025) * s * s;
                const across = -dx * sin + dy * cos - bend;
                const a = Math.abs(across) / length;
                const bodyWidth = bodyHalfWidth(s) * length;
                const body = Math.abs(across) < bodyWidth;
                // Oval paddles sweep back from the shoulders; smaller pelvic fins sit near the tail.
                const fin = Math.pow((s - 0.32 - (a - 0.14) * 0.8) / 0.11, 2) + Math.pow((a - 0.16) / (0.085 * flutter), 2) < 1
                    || Math.pow((s - 0.58) / 0.07, 2) + Math.pow((a - 0.085) / 0.045, 2) < 1;
                // Two rounded lobes form a short fan tail with a shallow central notch.
                const tail = s > 0.76 && Math.pow((s - 0.94) / 0.18, 2) + Math.pow((a - 0.065 * flutter) / 0.085, 2) < 1
                    && s < 0.99 + a * 0.8;
                if (!body && !fin && !tail) continue;

                const cross = Math.max(-1, Math.min(1, across / (bodyWidth || length * 0.15)));
                // A rounded back under a fixed upper-left light; turning changes its shade.
                const light = Math.max(0.12, Math.min(1, 0.76 - 0.28 * cross * cross + cross * (sin - cos) * 0.18));
                const marking = Math.sin(s * 13 + fish.phase * 0.7) + 0.6 * Math.cos(cross * 3.3 + s * 4 + fish.phase) > 0.05;
                const ink = (index === 2 || index === 4) && s > 0.18
                    && Math.sin(s * 24 + fish.phase) + Math.cos(cross * 6 + fish.phase) > (index === 2 ? 0.95 : 1.3);
                const color = !body ? [200, 184, 143] : ink ? [43, 49, 46] : marking ? fish.color : [213, 213, 191];
                const eye = body && eyes.has(gx + gy * columns);
                const density = Math.min(8, Math.floor((1 - light) * 8));
                // Fade beneath the text while keeping the rest of the pond visible.
                let distance = Infinity;
                for (const bounds of textBounds) {
                    distance = Math.min(distance, Math.hypot(
                        Math.max(bounds.left - px, 0, px - bounds.right),
                        Math.max(bounds.top - py, 0, py - bounds.bottom)
                    ));
                }
                ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, distance / 60);
                ctx.fillStyle = `rgba(${color.map(value => Math.round(value * (0.82 + light * 0.18))).join(',')}, ${body ? 0.9 : 0.45})`;
                ctx.fillRect(gx * cell + 0.5, gy * stepY + 0.5, cell - 1, stepY - 1);
                ctx.fillStyle = eye ? '#202d29' : !body ? 'rgba(130, 115, 80, 0.7)' : ink ? '#d8d8bd' : marking ? (fish.markingInk || '#873b12') : '#6b7667';
                const rayAlong = (tail ? 0.78 : 0.24) - s;
                const rayAcross = across / length - Math.sign(across) * (tail ? 0 : 0.12);
                const rayX = rayAlong * cos - rayAcross * sin;
                const rayY = rayAlong * sin + rayAcross * cos;
                const finGlyph = Math.abs(rayX) > Math.abs(rayY) * 2 ? '-' : Math.abs(rayY) > Math.abs(rayX) * 2 ? '|' : rayX * rayY > 0 ? '\\' : '/';
                ctx.fillText(eye ? '@' : body ? glyphs[density] : finGlyph, px, py);
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawRipples() {
        for (const ripple of ripples) {
            const age = time - ripple.time;
            const wake = ripple.kind === 'wake';
            const dash = ripple.kind === 'dash' || ripple.kind === 'lotus';
            const radius = 8 + age * (wake ? 20 : dash ? 55 : 43);
            const opacity = wake ? 0.22 : dash ? 0.46 : 0.55;
            ctx.fillStyle = `rgba(73, 113, 112, ${Math.max(0, opacity * (1 - age / 2.4))})`;
            // Only sample the ripple's bounding box, even on a full-screen canvas.
            const reach = radius + cell;
            const row = Math.max(0, Math.floor((ripple.y - reach / 1.45) / (cell * 1.5)));
            const col = Math.max(0, Math.floor((ripple.x - reach) / cell));
            for (let y = (row + 0.5) * cell * 1.5; y < Math.min(height, ripple.y + reach / 1.45); y += cell * 1.5) {
                for (let x = (col + 0.5) * cell; x < Math.min(width, ripple.x + reach); x += cell) {
                    // Quiet tail wakes open behind the fish; a dash leaves two expanding rings.
                    if (wake && (x - ripple.x) * ripple.cos + (y - ripple.y) * ripple.sin > radius * 0.15) continue;
                    const distance = Math.hypot(x - ripple.x, (y - ripple.y) * 1.45);
                    if (Math.abs(distance - radius) < cell * 0.65 || (dash && radius > 24 && Math.abs(distance - (radius - 18)) < cell * 0.65)) ctx.fillText('~', x, y);
                }
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        ctx.font = `bold ${cell * 1.45}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        drawWater();
        drawRipples();
        koi.slice(0, width < 600 ? 3 : 5).forEach(drawKoi);
        drawLilyPads();
        drawLotus();
    }

    function animate(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        time += dt;
        last = now;
        while (ripples.length && time - ripples[0].time > 2.4) ripples.shift();
        updateFish(dt);
        draw();
        frame = requestAnimationFrame(animate);
    }

    function syncPlayback() {
        cancelAnimationFrame(frame);
        toggle.textContent = paused ? 'Play pond' : 'Pause pond';
        hint.textContent = paused ? 'The pond is resting.' : 'Tap the lotus pod to draw the koi closer.';
        podButton.disabled = paused;
        if (!paused && visible && !document.hidden) {
            last = performance.now();
            frame = requestAnimationFrame(animate);
        }
    }

    function resize() {
        measureText();
        const bounds = canvas.getBoundingClientRect();
        width = bounds.width;
        height = bounds.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ripples.length = 0;
        koi.forEach(fish => {
            fish.offsetX = 0;
            fish.offsetY = 0;
            fish.heading = null;
            fish.reaction = null;
        });
        draw();
    }

    podButton.addEventListener('click', () => {
        if (paused || time - podShakeStart < 1.6) return;
        podShakeStart = time;
        const x = width * lilyPads[1].x;
        const y = height * lilyPads[1].y;
        addRipple(x, y, 'lotus');
        attractToPod(x, y);
    });
    toggle.addEventListener('click', () => {
        paused = !paused;
        syncPlayback();
    });
    motion.addEventListener('change', () => {
        paused = motion.matches;
        syncPlayback();
    });
    document.addEventListener('visibilitychange', syncPlayback);
    window.addEventListener('scroll', () => {
        measureText();
        if (paused) draw();
    }, { passive: true });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resizeObserver.observe(intro);
    resizeObserver.observe(navigation);
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncPlayback();
    }).observe(canvas);
    document.querySelector('.pond-controls').hidden = false;
    podButton.hidden = false;
    resize();
    syncPlayback();
})();
