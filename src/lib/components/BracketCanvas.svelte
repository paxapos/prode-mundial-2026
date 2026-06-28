<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { getFlagUrl } from '$lib/teams';
	import { FLOW, loserConnections, winnerConnections } from '$lib/bracket-rules';
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
		thirdplace: -1450,
		final: -1450
	};
	const LAYER_3RD_Z = -1450;

	// ── Stage metadata ──
	const STAGES_ORDERED = ['round32', 'round16', 'quarterfinal', 'semifinal', 'thirdplace', 'final'] as const;
	const STAGE_NAMES: Record<string, string> = {
		round32: '16avos de Final',
		round16: 'Octavos de Final',
		quarterfinal: 'Cuartos de Final',
		semifinal: 'Semifinales',
		thirdplace: 'Final por tercer puesto',
		final: 'Final & 3er Puesto'
	};
	const STAGE_COLORS_UI: Record<string, { bg: string; text: string }> = {
		round32: { bg: 'bg-indigo-500', text: 'text-white' },
		round16: { bg: 'bg-violet-500', text: 'text-white' },
		quarterfinal: { bg: 'bg-purple-500', text: 'text-white' },
		semifinal: { bg: 'bg-fuchsia-500', text: 'text-white' },
		thirdplace: { bg: 'bg-orange-500', text: 'text-white' },
		final: { bg: 'bg-amber-500', text: 'text-white' }
	};
	const CARD_STAGE_CLR: Record<string, string> = {
		round32: '#6366f1', round16: '#8b5cf6', quarterfinal: '#a855f7',
		semifinal: '#d946ef', thirdplace: '#f97316', final: '#f59e0b'
	};
	const CARD_STAGE_LBL: Record<string, string> = {
		round32: '16AVOS', round16: 'OCTAVOS', quarterfinal: 'CUARTOS',
		semifinal: 'SEMIS', thirdplace: '3ER PUESTO', final: 'FINAL'
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

	/** Stage of a node, inferred from its id */
	function stageOf(id: string): string {
		if (id.startsWith('r32-')) return 'round32';
		if (id.startsWith('r16-')) return 'round16';
		if (id.startsWith('qf-')) return 'quarterfinal';
		if (id.startsWith('sf-')) return 'semifinal';
		if (id === 'final') return 'final';
		if (id === '3rd') return 'thirdplace';
		return 'round32';
	}

	// ── Build the bracket tree from FLOW: target → [A-feeder, B-feeder] ──
	const CHILDREN = new Map<string, [string?, string?]>();
	for (const [fromId, flow] of Object.entries(FLOW)) {
		const [toId, side] = flow.w;
		const pair = CHILDREN.get(toId) ?? ([undefined, undefined] as [string?, string?]);
		pair[side === 'A' ? 0 : 1] = fromId;
		CHILDREN.set(toId, pair);
	}

	/** Depth-first leaf (R32) order under a subtree root — defines vertical stacking */
	function leafOrder(rootId: string): string[] {
		const out: string[] = [];
		const walk = (id: string) => {
			const kids = CHILDREN.get(id);
			if (!kids) { out.push(id); return; }
			for (const k of kids) if (k) walk(k);
		};
		walk(rootId);
		return out;
	}

	// Left half feeds sf-01, right half feeds sf-02 (true FIFA bracket halves)
	const LEFT_LEAVES = leafOrder('sf-01');
	const RIGHT_LEAVES = leafOrder('sf-02');

	// Which nodes live on the left half (used for connector direction)
	const LEFT_SET = new Set<string>();
	{
		const mark = (id: string) => {
			LEFT_SET.add(id);
			const kids = CHILDREN.get(id);
			if (kids) for (const k of kids) if (k) mark(k);
		};
		mark('sf-01');
	}

	const WINNER_CONNS = winnerConnections();
	const LOSER_CONNS = loserConnections();

	// Vertical span (center-to-center) of each stage's column — filled by computeBasePositions
	const STAGE_SPAN: Record<string, number> = {};

	// Mesh storage
	let cardMeshes: { mesh: THREE.Mesh; shadow: THREE.Mesh; id: string; stage: string }[] = [];
	let basePositions = new Map<string, { baseX: number; y: number; z: number; baseY: number }>();
	let connGroup = new THREE.Group();
	let glowMesh: THREE.Mesh;

	/** Camera distance so a whole stage column fits comfortably in the viewport */
	function stageViewDist(stage: string): number {
		const span = STAGE_SPAN[stage] ?? 0;
		return (span / 2 + CARD_H * 1.7) / TAN_HALF_FOV + 70;
	}

	// ── Compute base positions as a clean binary tree derived from FLOW ──
	// Every match sits exactly at the vertical midpoint of the two matches that
	// feed it, and those two feeders are stacked one directly above the other.
	// This guarantees the connectors form a real tournament tree with no crossings.
	function computeBasePositions(cw: number, ch: number): void {
		const aspect = cw / ch;
		basePositions.clear();

		const UGAP = CARD_H * 0.5;
		const vGap = CARD_H + UGAP; // R32 center-to-center spacing

		const minCol = (CARD_W + UGAP) / 2;
		const COL: Record<string, number> = {
			round32: Math.max(minCol, CARD_W * 1.15),
			round16: Math.max(minCol, CARD_W * 0.78),
			quarterfinal: Math.max(minCol, CARD_W * 0.64),
			semifinal: Math.max(minCol, CARD_W * 0.6)
		};

		// Recursively place a subtree; returns the node's Y (centered between children)
		function place(id: string, side: 'left' | 'right'): number {
			const stage = stageOf(id);
			const sign = side === 'left' ? -1 : 1;
			const kids = CHILDREN.get(id);
			let y: number;
			if (!kids) {
				const leaves = side === 'left' ? LEFT_LEAVES : RIGHT_LEAVES;
				const idx = leaves.indexOf(id);
				y = ((leaves.length - 1) / 2 - idx) * vGap;
			} else {
				const ys = kids.filter((k): k is string => !!k).map((k) => place(k, side));
				y = ys.reduce((a, b) => a + b, 0) / ys.length;
			}
			const col = COL[stage] ?? minCol;
			basePositions.set(id, { baseX: sign * col, baseY: y, y, z: LAYER_Z[stage] });
			return y;
		}

		place('sf-01', 'left');
		place('sf-02', 'right');

		// Final at center back, 3rd-place match just below it
		basePositions.set('final', { baseX: 0, baseY: 0, y: 0, z: LAYER_Z.final });
		basePositions.set('3rd', { baseX: 0, baseY: -(vGap * 0.95), y: -(vGap * 0.95), z: LAYER_3RD_Z });

		// Vertical span per stage (for camera framing)
		const byStage: Record<string, number[]> = {};
		for (const [id, bp] of basePositions) {
			(byStage[stageOf(id)] ??= []).push(bp.baseY);
		}
		for (const st of STAGES_ORDERED) {
			const ys = byStage[st] ?? [0];
			STAGE_SPAN[st] = Math.max(...ys) - Math.min(...ys);
		}

		// Camera distance so all 8 R32 cards per side fit (vertical & horizontal)
		const needV = STAGE_SPAN.round32 / 2 + CARD_H;
		const needH = COL.round32 + CARD_W / 2 + CARD_W * 0.2;
		initialCamZ = Math.max(
			needV / TAN_HALF_FOV + 80,
			needH / (TAN_HALF_FOV * aspect) + 80
		);
	}

	/** Format a kickoff ISO date as "dd/mm · HH:mm" in the viewer's local time */
	function formatKickoff(iso: string): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		const date = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
		const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
		return `${date} · ${time}`;
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
		ctx.textAlign = 'left';
		ctx.fillText(CARD_STAGE_LBL[match.stage] ?? match.stage.toUpperCase(), 8, 15);
		// Kickoff date/time, right-aligned in the header (helps locate matches by fecha)
		const when = formatKickoff(match.kickoffAt);
		if (when) {
			ctx.font = '600 8.5px system-ui, -apple-system, sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(when, w - 8, 15);
		}

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

	// ── Build connectors as a static tree (positions never change at runtime) ──
	function rebuildConnectors() {
		if (connGroup) scene.remove(connGroup);
		connGroup = new THREE.Group();
		const mat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 });

		for (const [fromId, toId] of WINNER_CONNS) {
			const fb = basePositions.get(fromId), tb = basePositions.get(toId);
			if (!fb || !tb) continue;
			const isL = fb.baseX < 0;
			const ex = fb.baseX + (isL ? CARD_W / 2 : -CARD_W / 2);
			const en = tb.baseX + (isL ? -CARD_W / 2 : CARD_W / 2);
			const d = isL ? 1 : -1;
			const zM = (fb.z + tb.z) / 2;

			// Horizontal run out of the feeder, then a smooth elbow up/down into the parent
			const curve = new THREE.CubicBezierCurve3(
				new THREE.Vector3(ex, fb.baseY, fb.z),
				new THREE.Vector3(ex + d * 50, fb.baseY, zM * 0.7 + fb.z * 0.3),
				new THREE.Vector3(en - d * 50, tb.baseY, zM * 0.3 + tb.z * 0.7),
				new THREE.Vector3(en, tb.baseY, tb.z)
			);
			connGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), mat));
		}

		const dMat = new THREE.LineDashedMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.3, dashSize: 8, gapSize: 6 });
		for (const [fromId, toId] of LOSER_CONNS) {
			const fb = basePositions.get(fromId), tb = basePositions.get(toId);
			if (!fb || !tb) continue;
			const isL = fb.baseX < 0;
			const pts = [
				new THREE.Vector3(fb.baseX + (isL ? CARD_W / 2 : -CARD_W / 2), fb.baseY, fb.z),
				new THREE.Vector3(tb.baseX, tb.baseY, tb.z)
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

		// Card / connector positions are a static tree — only the camera moves.
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
	let pointerId: number | null = null;

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		targetZoomT = Math.max(0, Math.min(1, targetZoomT + e.deltaY * 0.0008));
	}
	function onPointerDown(e: PointerEvent) {
		// Ignore if a pinch is happening
		if (e.pointerType === 'touch' && pointerId !== null) return;
		isDragging = true;
		pointerId = e.pointerId;
		lastPointer = { x: e.clientX, y: e.clientY };
		container.style.cursor = 'grabbing';
		try { container.setPointerCapture(e.pointerId); } catch { /* */ }
	}
	function onPointerMove(e: PointerEvent) {
		if (!isDragging || e.pointerId !== pointerId) return;
		const dx = e.clientX - lastPointer.x, dy = e.clientY - lastPointer.y;
		lastPointer = { x: e.clientX, y: e.clientY };
		targetPanX -= dx * 1.8; targetPanY += dy * 1.8;
	}
	function onPointerUp(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		isDragging = false;
		pointerId = null;
		container.style.cursor = 'grab';
		try { container.releasePointerCapture(e.pointerId); } catch { /* */ }
	}
	function onTouchStart(e: TouchEvent) {
		if (e.touches.length === 2) {
			e.preventDefault();
			isDragging = false; // cancel drag during pinch
			pointerId = null;
			const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
			pinchStartDist = Math.sqrt(dx * dx + dy * dy); pinchStartZoomT = targetZoomT;
		}
	}
	function onTouchMove(e: TouchEvent) {
		if (e.touches.length === 2) {
			e.preventDefault();
			const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const delta = (dist - pinchStartDist) / 500;
			targetZoomT = Math.max(0, Math.min(1, pinchStartZoomT + delta));
		}
	}
	function onTouchEnd(e: TouchEvent) {
		if (e.touches.length < 2) {
			// pinch ended, allow single-finger drag again
		}
	}
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
