<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { getFlagUrl } from '$lib/teams';
	import type { Match } from '$lib/types';

	interface Props {
		matches: Match[];
		onAutoScroll?: boolean;
	}

	let { matches, onAutoScroll = false }: Props = $props();

	let container: HTMLDivElement;
	let renderer: THREE.WebGLRenderer;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let animId: number;

	// ── Z layers for each stage (front → back) ──
	const LAYER_Z: Record<string, number> = {
		round32: 0,
		round16: -350,
		quarterfinal: -700,
		semifinal: -1050,
		final: -1450
	};
	const LAYER_3RD_Z = -1450;

	// ── Stage metadata ──
	const STAGES_ORDERED = ['round32', 'round16', 'quarterfinal', 'semifinal', 'final'] as const;
	const STAGE_NAMES: Record<string, string> = {
		round32: '16avos de Final',
		round16: 'Octavos de Final',
		quarterfinal: 'Cuartos de Final',
		semifinal: 'Semifinales',
		final: 'Final & 3er Puesto'
	};
	const STAGE_COLORS_UI: Record<string, { bg: string; text: string }> = {
		round32: { bg: 'bg-indigo-500', text: 'text-white' },
		round16: { bg: 'bg-violet-500', text: 'text-white' },
		quarterfinal: { bg: 'bg-purple-500', text: 'text-white' },
		semifinal: { bg: 'bg-fuchsia-500', text: 'text-white' },
		final: { bg: 'bg-amber-500', text: 'text-white' }
	};
	const CARD_STAGE_CLR: Record<string, string> = {
		round32: '#6366f1', round16: '#8b5cf6', quarterfinal: '#a855f7',
		semifinal: '#d946ef', final: '#f59e0b', '3rd': '#78716c'
	};
	const CARD_STAGE_LBL: Record<string, string> = {
		round32: '16AVOS', round16: 'OCTAVOS', quarterfinal: 'CUARTOS',
		semifinal: 'SEMIS', final: 'FINAL', '3rd': '3ER PUESTO'
	};

	// ── Camera / interaction ──
	let zoomT = 0; // 0=R32, 1=final
	let targetZoomT = 0;
	let panX = 0, panY = 0;
	let targetPanX = 0, targetPanY = 0;
	let isDragging = false;
	let lastPointer = { x: 0, y: 0 };
	let pinchStartDist = 0;
	let pinchStartZoomT = 0;

	// Gyroscope
	let gyroOffset = { x: 0, y: 0 };
	let smoothGyro = { x: 0, y: 0 };
	let gyroBase: { beta: number; gamma: number } | null = null;

	// Reactive stage label
	let currentStageKey = $state('round32');

	// Responsive card size
	let CARD_W = 250;
	let CARD_H = 88;
	let initialCamZ = 900;
	const FOV_DEG = 50;
	const TAN_HALF_FOV = Math.tan((FOV_DEG / 2) * Math.PI / 180);

	/** Compute camera distance so all N cards per side fit in viewport */
	function stageViewDist(stage: string): number {
		const n = STAGE_COUNT_PER_SIDE[stage] ?? 1;
		if (n <= 1) return 300;
		const optGap = CARD_H * 1.4;
		const totalSpan = (n - 1) * optGap;
		return (totalSpan / 2 + CARD_H) / TAN_HALF_FOV + 60;
	}

	const LEFT_SET = new Set([
		'r32-01','r32-02','r32-03','r32-04','r32-05','r32-06','r32-07','r32-08',
		'r16-01','r16-02','r16-03','r16-04',
		'qf-01','qf-02','sf-01'
	]);

	const WINNER_CONNS: [string, string][] = [
		['r32-01','r16-01'],['r32-02','r16-01'],['r32-03','r16-02'],['r32-04','r16-02'],
		['r32-05','r16-03'],['r32-06','r16-03'],['r32-07','r16-04'],['r32-08','r16-04'],
		['r32-09','r16-05'],['r32-10','r16-05'],['r32-11','r16-06'],['r32-12','r16-06'],
		['r32-13','r16-07'],['r32-14','r16-07'],['r32-15','r16-08'],['r32-16','r16-08'],
		['r16-01','qf-01'],['r16-02','qf-01'],['r16-03','qf-02'],['r16-04','qf-02'],
		['r16-05','qf-03'],['r16-06','qf-03'],['r16-07','qf-04'],['r16-08','qf-04'],
		['qf-01','sf-01'],['qf-02','sf-01'],['qf-03','sf-02'],['qf-04','sf-02'],
		['sf-01','final'],['sf-02','final']
	];
	const LOSER_CONNS: [string, string][] = [['sf-01','3rd'],['sf-02','3rd']];

	// How many cards per side for each stage (for optimal spread computation)
	const STAGE_COUNT_PER_SIDE: Record<string, number> = {
		round32: 8, round16: 4, quarterfinal: 2, semifinal: 1, final: 1
	};

	// Mesh storage
	let cardMeshes: { mesh: THREE.Mesh; shadow: THREE.Mesh; id: string; stage: string }[] = [];
	let basePositions = new Map<string, { baseX: number; y: number; z: number; baseY: number }>();
	let connGroup = new THREE.Group();
	let glowMesh: THREE.Mesh;
	let canvasH = 600;

	// ── Compute base positions ──
	function computeBasePositions(cw: number, ch: number): void {
		canvasH = ch;
		const aspect = cw / ch;

		// Uniform gap: same spacing between card edges in X and Y
		const UGAP = CARD_H * 0.4;
		const vGap = CARD_H + UGAP; // vertical center-to-center
		const minColX = (CARD_W + UGAP) / 2; // minimum column center distance from axis

		// Column X per stage: wider for outer stages, never less than minColX
		const colR32 = Math.max(minColX, CARD_W * 1.15);
		const colR16 = Math.max(minColX, CARD_W * 0.75);
		const colQF = Math.max(minColX, CARD_W * 0.62);
		const colSF = Math.max(minColX, CARD_W * 0.58);

		const totalV = 7 * vGap; // center-to-center span of 8 cards

		// Compute initialCamZ so all R32 cards fit in frustum
		const needV = totalV / 2 + CARD_H;
		const needH = colR32 + CARD_W / 2 + CARD_W * 0.2;
		initialCamZ = Math.max(
			needV / TAN_HALF_FOV + 80,
			needH / (TAN_HALF_FOV * aspect) + 80
		);

		basePositions.clear();

		const lr32 = ['r32-01','r32-02','r32-03','r32-04','r32-05','r32-06','r32-07','r32-08'];
		for (let i = 0; i < 8; i++)
			basePositions.set(lr32[i], { baseX: -colR32, baseY: (3.5 - i) * vGap, y: (3.5 - i) * vGap, z: LAYER_Z.round32 });

		const lr16 = ['r16-01','r16-02','r16-03','r16-04'];
		for (let i = 0; i < 4; i++) {
			const y = (basePositions.get(lr32[i*2])!.baseY + basePositions.get(lr32[i*2+1])!.baseY) / 2;
			basePositions.set(lr16[i], { baseX: -colR16, baseY: y, y, z: LAYER_Z.round16 });
		}

		const lqf = ['qf-01','qf-02'];
		for (let i = 0; i < 2; i++) {
			const y = (basePositions.get(lr16[i*2])!.baseY + basePositions.get(lr16[i*2+1])!.baseY) / 2;
			basePositions.set(lqf[i], { baseX: -colQF, baseY: y, y, z: LAYER_Z.quarterfinal });
		}

		const sfY = (basePositions.get('qf-01')!.baseY + basePositions.get('qf-02')!.baseY) / 2;
		basePositions.set('sf-01', { baseX: -colSF, baseY: sfY, y: sfY, z: LAYER_Z.semifinal });

		const rr32 = ['r32-09','r32-10','r32-11','r32-12','r32-13','r32-14','r32-15','r32-16'];
		for (let i = 0; i < 8; i++)
			basePositions.set(rr32[i], { baseX: colR32, baseY: (3.5 - i) * vGap, y: (3.5 - i) * vGap, z: LAYER_Z.round32 });

		const rr16 = ['r16-05','r16-06','r16-07','r16-08'];
		for (let i = 0; i < 4; i++) {
			const y = (basePositions.get(rr32[i*2])!.baseY + basePositions.get(rr32[i*2+1])!.baseY) / 2;
			basePositions.set(rr16[i], { baseX: colR16, baseY: y, y, z: LAYER_Z.round16 });
		}

		const rqf = ['qf-03','qf-04'];
		for (let i = 0; i < 2; i++) {
			const y = (basePositions.get(rr16[i*2])!.baseY + basePositions.get(rr16[i*2+1])!.baseY) / 2;
			basePositions.set(rqf[i], { baseX: colQF, baseY: y, y, z: LAYER_Z.quarterfinal });
		}

		const sfY2 = (basePositions.get('qf-03')!.baseY + basePositions.get('qf-04')!.baseY) / 2;
		basePositions.set('sf-02', { baseX: colSF, baseY: sfY2, y: sfY2, z: LAYER_Z.semifinal });

		basePositions.set('final', { baseX: 0, baseY: CARD_H, y: CARD_H, z: LAYER_Z.final });
		basePositions.set('3rd', { baseX: 0, baseY: -(CARD_H + UGAP), y: -(CARD_H + UGAP), z: LAYER_3RD_Z });
	}

	/** Proximity factor: 0 when far, 1 when camera is right at the layer */
	function getProximity(stageZ: number, camZ: number): number {
		const dist = camZ - stageZ;
		return Math.max(0, Math.min(1, 1 - (dist - 100) / 600));
	}

	/** Dynamic X spread: layers near camera spread wide, far layers stay narrow */
	function getSpread(stageZ: number, camZ: number): number {
		return 1 + getProximity(stageZ, camZ) * 2.2;
	}

	function getWorldX(id: string, camZ: number): number {
		const bp = basePositions.get(id);
		if (!bp) return 0;
		return bp.baseX * getSpread(bp.z, camZ);
	}

	/** Compute dynamic Y: lerp from baseY (centered between parents) to optimal spread */
	function getWorldY(id: string, camZ: number): number {
		const bp = basePositions.get(id);
		if (!bp) return 0;
		const prox = getProximity(bp.z, camZ);
		if (prox <= 0) return bp.baseY;

		// Determine stage and per-side count
		const entry = cardMeshes.find(c => c.id === id);
		const stage = entry?.stage ?? 'round32';
		const n = STAGE_COUNT_PER_SIDE[stage] ?? 1;
		if (n <= 1) return bp.baseY; // single card, no spread needed

		// Compute optimal gap: fill visible vertical space with padding
		// but never below the uniform minimum
		const minGap = CARD_H * 1.4; // uniform min center-to-center
		const distToLayer = Math.max(200, camZ - bp.z);
		const visibleH = 2 * distToLayer * TAN_HALF_FOV;
		const optimalGap = Math.max(minGap, Math.min((visibleH * 0.85) / (n - 1), CARD_H * 3));

		// Collect the per-side cards for this stage sorted by baseY desc
		const isLeft = LEFT_SET.has(id);
		const siblings = [...basePositions.entries()]
			.filter(([k]) => {
				const ce = cardMeshes.find(c => c.id === k);
				return ce?.stage === stage && LEFT_SET.has(k) === isLeft;
			})
			.sort((a, b) => b[1].baseY - a[1].baseY);

		const idx = siblings.findIndex(([k]) => k === id);
		if (idx < 0) return bp.baseY;

		const optY = ((siblings.length - 1) / 2 - idx) * optimalGap;
		return bp.baseY + (optY - bp.baseY) * prox;
	}

	// ── Card texture ──
	function createCardTexture(match: Match, flagA: HTMLImageElement | null, flagB: HTMLImageElement | null): THREE.CanvasTexture {
		const w = CARD_W, h = CARD_H;
		const canvas = document.createElement('canvas');
		const s = 2;
		canvas.width = w * s;
		canvas.height = h * s;
		const ctx = canvas.getContext('2d')!;
		ctx.scale(s, s);

		const hasResult = match.scoreA !== null && match.scoreB !== null;
		const isFinal = match.id === 'final';
		const stageColor = CARD_STAGE_CLR[match.stage] ?? '#64748b';
		const headerH = 22, r = 10;

		ctx.beginPath(); ctx.roundRect(0, 0, w, h, r);
		ctx.fillStyle = isFinal ? '#fffbeb' : '#ffffff'; ctx.fill();
		ctx.strokeStyle = hasResult ? '#10b981' : (isFinal ? '#f59e0b' : '#e2e8f0');
		ctx.lineWidth = hasResult || isFinal ? 2 : 1; ctx.stroke();

		ctx.beginPath(); ctx.roundRect(0, 0, w, headerH, [r, r, 0, 0]);
		ctx.fillStyle = stageColor; ctx.fill();
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(CARD_STAGE_LBL[match.stage] ?? match.stage.toUpperCase(), w / 2, 15);

		const top = headerH + 3;
		const rowH = (h - top - 4) / 2;

		for (let i = 0; i < 2; i++) {
			const y = top + i * rowH;
			const name = i === 0 ? match.teamA : match.teamB;
			const score = i === 0 ? match.scoreA : match.scoreB;
			const flag = i === 0 ? flagA : flagB;

			let tx = 10;
			if (flag) { try { ctx.drawImage(flag, 8, y + (rowH - 16) / 2, 24, 16); tx = 38; } catch { /* */ } }

			ctx.fillStyle = '#1e293b';
			ctx.font = '600 12px system-ui, -apple-system, sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText(name.length > 20 ? name.slice(0, 19) + '…' : name, tx, y + rowH / 2 + 4);

			ctx.fillStyle = hasResult ? '#059669' : '#cbd5e1';
			ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(score !== null && score !== undefined ? String(score) : '–', w - 22, y + rowH / 2 + 5);

			if (i === 0) {
				ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
				ctx.beginPath(); ctx.moveTo(8, y + rowH); ctx.lineTo(w - 8, y + rowH); ctx.stroke();
			}
		}
		if (match.penaltyWinner) {
			ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center';
			ctx.fillText(`PEN: ${match.penaltyWinner === 'A' ? match.teamA : match.teamB}`, w / 2, h - 3);
		}

		const tex = new THREE.CanvasTexture(canvas);
		tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
		return tex;
	}

	async function loadFlag(name: string): Promise<HTMLImageElement | null> {
		const url = getFlagUrl(name, 40);
		if (!url) return null;
		return new Promise(r => {
			const img = new Image(); img.crossOrigin = 'anonymous';
			img.onload = () => r(img); img.onerror = () => r(null); img.src = url;
		});
	}

	function createGlowTexture(): THREE.CanvasTexture {
		const c = document.createElement('canvas'); c.width = 256; c.height = 256;
		const ctx = c.getContext('2d')!;
		const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
		g.addColorStop(0, 'rgba(245,158,11,0.5)'); g.addColorStop(0.5, 'rgba(245,158,11,0.12)'); g.addColorStop(1, 'rgba(245,158,11,0)');
		ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
		return new THREE.CanvasTexture(c);
	}

	// ── Reconstruct connectors ──
	function rebuildConnectors() {
		scene.remove(connGroup);
		connGroup = new THREE.Group();
		const camZ = getCamZ();
		const mat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4 });

		for (const [fromId, toId] of WINNER_CONNS) {
			const fb = basePositions.get(fromId), tb = basePositions.get(toId);
			if (!fb || !tb) continue;
			const fromX = getWorldX(fromId, camZ);
			const toX = getWorldX(toId, camZ);
			const fromY = getWorldY(fromId, camZ);
			const toY = getWorldY(toId, camZ);
			const isL = LEFT_SET.has(fromId);
			const ex = fromX + (isL ? CARD_W / 2 : -CARD_W / 2);
			const en = toX + (isL ? -CARD_W / 2 : CARD_W / 2);
			const d = isL ? 1 : -1;
			const zM = (fb.z + tb.z) / 2;

			const curve = new THREE.CubicBezierCurve3(
				new THREE.Vector3(ex, fromY, fb.z),
				new THREE.Vector3(ex + d * 40, fromY, zM * 0.7 + fb.z * 0.3),
				new THREE.Vector3(en - d * 40, toY, zM * 0.3 + tb.z * 0.7),
				new THREE.Vector3(en, toY, tb.z)
			);
			connGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(18)), mat));
		}

		const dMat = new THREE.LineDashedMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.2, dashSize: 8, gapSize: 6 });
		for (const [fromId, toId] of LOSER_CONNS) {
			const fb = basePositions.get(fromId), tb = basePositions.get(toId);
			if (!fb || !tb) continue;
			const fx = getWorldX(fromId, camZ), tx = getWorldX(toId, camZ);
			const fy = getWorldY(fromId, camZ), ty = getWorldY(toId, camZ);
			const isL = LEFT_SET.has(fromId);
			const pts = [
				new THREE.Vector3(fx + (isL ? CARD_W / 2 : -CARD_W / 2), fy, fb.z),
				new THREE.Vector3(tx, ty, tb.z)
			];
			const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dMat);
			l.computeLineDistances();
			connGroup.add(l);
		}
		scene.add(connGroup);
	}

	function getCamZ(): number {
		const camZFinal = LAYER_Z.final + 280;
		return initialCamZ - zoomT * (initialCamZ - camZFinal);
	}

	function detectStage(): string {
		const camZ = getCamZ();
		let closest = 'round32';
		let best = Infinity;
		for (const st of STAGES_ORDERED) {
			const idealCamZ = LAYER_Z[st] + stageViewDist(st);
			const d = Math.abs(camZ - idealCamZ);
			if (d < best) { best = d; closest = st; }
		}
		return closest;
	}

	async function buildScene() {
		if (!container) return;
		const w = container.clientWidth, h = container.clientHeight;
		CARD_W = Math.max(170, Math.min(280, w * 0.22));
		CARD_H = CARD_W * 0.35;
		computeBasePositions(w, h);

		renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(w, h);
		renderer.setClearColor(0xf0f4f8);
		container.appendChild(renderer.domElement);

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0xf0f4f8);
		scene.fog = new THREE.Fog(0xf0f4f8, initialCamZ * 0.6, initialCamZ + 1200);

		camera = new THREE.PerspectiveCamera(FOV_DEG, w / h, 10, initialCamZ + 2500);
		scene.add(new THREE.AmbientLight(0xffffff, 1));

		const bracketMatches = matches.filter(m => m.stage !== 'groups');
		const teams = new Set<string>();
		for (const m of bracketMatches) { teams.add(m.teamA); teams.add(m.teamB); }
		const flags = new Map<string, HTMLImageElement | null>();
		await Promise.all([...teams].map(async t => { flags.set(t, await loadFlag(t)); }));

		for (const m of bracketMatches) {
			const bp = basePositions.get(m.id);
			if (!bp) continue;
			const tex = createCardTexture(m, flags.get(m.teamA) ?? null, flags.get(m.teamB) ?? null);
			const geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
			const mt = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
			const mesh = new THREE.Mesh(geo, mt);
			mesh.position.set(bp.baseX, bp.y, bp.z);
			scene.add(mesh);
			const sGeo = new THREE.PlaneGeometry(CARD_W + 3, CARD_H + 3);
			const sMt = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.04 });
			const sMesh = new THREE.Mesh(sGeo, sMt);
			sMesh.position.set(bp.baseX + 2, bp.y - 2, bp.z - 1);
			scene.add(sMesh);
			cardMeshes.push({ mesh, shadow: sMesh, id: m.id, stage: m.stage });
		}

		const fb = basePositions.get('final');
		if (fb) {
			const gg = new THREE.PlaneGeometry(CARD_W * 3, CARD_H * 5);
			const gm = new THREE.MeshBasicMaterial({ map: createGlowTexture(), transparent: true });
			glowMesh = new THREE.Mesh(gg, gm);
			glowMesh.position.set(0, fb.y, fb.z - 8);
			scene.add(glowMesh);
		}

		rebuildConnectors();

		const gridGeo = new THREE.PlaneGeometry(3000, 2400, 30, 24);
		const gridMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1, wireframe: true, transparent: true, opacity: 0.04 });
		const grid = new THREE.Mesh(gridGeo, gridMat);
		grid.rotation.x = -Math.PI / 2;
		grid.position.set(0, -400, -700);
		scene.add(grid);

		if (onAutoScroll) {
			const now = new Date();
			let dStage = 'round32';
			for (const m of bracketMatches) {
				if (new Date(m.kickoffAt) <= now) {
					const i = STAGES_ORDERED.indexOf(m.stage as any);
					if (i > STAGES_ORDERED.indexOf(dStage as any)) dStage = m.stage;
				}
			}
			targetZoomT = STAGES_ORDERED.indexOf(dStage as any) / (STAGES_ORDERED.length - 1);
			zoomT = targetZoomT;
		}
		animate();
	}

	function animate() {
		animId = requestAnimationFrame(animate);
		if (!container) return;

		zoomT += (targetZoomT - zoomT) * 0.065;
		panX += (targetPanX - panX) * 0.08;
		panY += (targetPanY - panY) * 0.08;
		smoothGyro.x += (gyroOffset.x - smoothGyro.x) * 0.06;
		smoothGyro.y += (gyroOffset.y - smoothGyro.y) * 0.06;

		const camZ = getCamZ();

		for (const e of cardMeshes) {
			const bp = basePositions.get(e.id);
			if (!bp) continue;
			const x = getWorldX(e.id, camZ);
			const y = getWorldY(e.id, camZ);
			e.mesh.position.x = x;
			e.mesh.position.y = y;
			e.shadow.position.x = x + 2;
			e.shadow.position.y = y - 2;
		}

		rebuildConnectors();

		if (glowMesh) {
			const fb = basePositions.get('final');
			if (fb) {
				glowMesh.position.x = getWorldX('final', camZ);
				glowMesh.position.y = getWorldY('final', camZ);
			}
		}

		if (scene.fog instanceof THREE.Fog) {
			scene.fog.near = initialCamZ * 0.5 + zoomT * initialCamZ * 0.4;
			scene.fog.far = initialCamZ + 800 + zoomT * 600;
		}

		currentStageKey = detectStage();

		const gx = smoothGyro.x * 80, gy = smoothGyro.y * 50;
		camera.position.set(panX + gx, panY + 80 + gy, camZ);
		camera.lookAt(panX, panY, camZ - 600);
		renderer.render(scene, camera);
	}

	// ── Interaction ──
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		targetZoomT = Math.max(0, Math.min(1, targetZoomT + e.deltaY * 0.0008));
	}
	function onPointerDown(e: PointerEvent) { isDragging = true; lastPointer = { x: e.clientX, y: e.clientY }; container.style.cursor = 'grabbing'; }
	function onPointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const dx = e.clientX - lastPointer.x, dy = e.clientY - lastPointer.y;
		lastPointer = { x: e.clientX, y: e.clientY };
		targetPanX -= dx * 2.5; targetPanY += dy * 2.5;
	}
	function onPointerUp() { isDragging = false; container.style.cursor = 'grab'; }
	function onTouchStart(e: TouchEvent) {
		if (e.touches.length === 2) {
			e.preventDefault();
			const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
			pinchStartDist = Math.sqrt(dx * dx + dy * dy); pinchStartZoomT = targetZoomT;
		} else if (e.touches.length === 1) { isDragging = true; lastPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
	}
	function onTouchMove(e: TouchEvent) {
		if (e.touches.length === 2) {
			e.preventDefault();
			const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			targetZoomT = Math.max(0, Math.min(1, pinchStartZoomT + (dist - pinchStartDist) / 400));
		} else if (e.touches.length === 1 && isDragging) {
			const dx = e.touches[0].clientX - lastPointer.x, dy = e.touches[0].clientY - lastPointer.y;
			lastPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
			targetPanX -= dx * 2.5; targetPanY += dy * 2.5;
		}
	}
	function onTouchEnd(e: TouchEvent) { if (e.touches.length < 2) isDragging = false; }
	function onResize() {
		if (!renderer || !container || !camera) return;
		const w = container.clientWidth, h = container.clientHeight;
		renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
		CARD_W = Math.max(170, Math.min(280, w * 0.22)); CARD_H = CARD_W * 0.35;
		computeBasePositions(w, h);
	}
	function onDeviceOrientation(e: DeviceOrientationEvent) {
		if (e.beta === null || e.gamma === null) return;
		if (!gyroBase) gyroBase = { beta: e.beta, gamma: e.gamma };
		gyroOffset.x = Math.max(-30, Math.min(30, e.gamma - gyroBase.gamma)) / 30;
		gyroOffset.y = -(Math.max(-30, Math.min(30, e.beta - gyroBase.beta)) / 30);
	}
	function requestGyro() {
		const doe = DeviceOrientationEvent as any;
		if (typeof doe.requestPermission === 'function') {
			doe.requestPermission().then((r: string) => { if (r === 'granted') window.addEventListener('deviceorientation', onDeviceOrientation); }).catch(() => {});
		} else { window.addEventListener('deviceorientation', onDeviceOrientation); }
	}
	function goToStage(idx: number) {
		const stage = STAGES_ORDERED[idx];
		const targetCamZ = LAYER_Z[stage] + stageViewDist(stage);
		const camZFinal = LAYER_Z.final + 280;
		const range = initialCamZ - camZFinal;
		targetZoomT = Math.max(0, Math.min(1, (initialCamZ - targetCamZ) / range));
		targetPanX = 0;
		targetPanY = 0;
	}

	onMount(() => { buildScene(); window.addEventListener('resize', onResize); requestGyro(); });
	onDestroy(() => {
		if (animId) cancelAnimationFrame(animId);
		if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
		window.removeEventListener('resize', onResize);
		window.removeEventListener('deviceorientation', onDeviceOrientation);
	});
</script>

<div
	class="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f0f4f8] shadow-sm"
	style="height: 78vh; min-height: 520px; touch-action: none;"
>
	<!-- Floating stage label -->
	<div class="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
		<div class="pointer-events-auto rounded-xl {STAGE_COLORS_UI[currentStageKey]?.bg ?? 'bg-slate-500'} {STAGE_COLORS_UI[currentStageKey]?.text ?? 'text-white'} px-5 py-2 text-sm font-black tracking-wide shadow-lg transition-all duration-300">
			{STAGE_NAMES[currentStageKey] ?? currentStageKey}
		</div>
	</div>

	<!-- Stage quick-nav pills -->
	<div class="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1">
		{#each STAGES_ORDERED as st, idx}
			<button
				onclick={() => goToStage(idx)}
				class="rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur transition-all
					{currentStageKey === st
						? (STAGE_COLORS_UI[st]?.bg ?? 'bg-slate-500') + ' text-white'
						: 'bg-white/90 text-slate-600 hover:bg-white'}"
			>{CARD_STAGE_LBL[st] ?? st}</button>
		{/each}
	</div>

	<!-- Zoom + reset -->
	<div class="absolute bottom-3 right-3 z-10 flex gap-1.5">
		<button onclick={() => { targetZoomT = Math.min(1, targetZoomT + 0.2); }}
			class="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-base font-bold text-slate-700 shadow-sm backdrop-blur hover:bg-white" aria-label="Zoom in">+</button>
		<button onclick={() => { targetZoomT = Math.max(0, targetZoomT - 0.2); }}
			class="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-base font-bold text-slate-700 shadow-sm backdrop-blur hover:bg-white" aria-label="Zoom out">−</button>
		<button onclick={() => { targetZoomT = 0; targetPanX = 0; targetPanY = 0; }}
			class="flex h-8 items-center justify-center rounded-full bg-white/90 px-2.5 text-xs font-bold text-slate-600 shadow-sm backdrop-blur hover:bg-white" aria-label="Reset">⟲</button>
	</div>

	<!-- Help -->
	<div class="pointer-events-none absolute right-3 top-3 z-10">
		<span class="rounded-lg bg-white/80 px-2.5 py-1 text-[10px] font-medium text-slate-400 shadow-sm backdrop-blur">
			Scroll / Pinch = avanzar fase
		</span>
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div bind:this={container} class="h-full w-full cursor-grab"
		onwheel={onWheel} onpointerdown={onPointerDown} onpointermove={onPointerMove}
		onpointerup={onPointerUp} onpointerleave={onPointerUp}
		ontouchstart={onTouchStart} ontouchmove={onTouchMove} ontouchend={onTouchEnd}
	></div>
</div>
