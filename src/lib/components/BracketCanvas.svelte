<script module lang="ts">
	// Flags are cached across mounts so re-opening the bracket tab is instant.
	const flagCache = new Map<string, HTMLImageElement | null>();
</script>

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

	/** Kickoff time (ms) of a match id, Infinity if unknown */
	function matchTimeOf(id: string): number {
		const m = matches.find((mm) => mm.id === id);
		if (!m) return Infinity;
		const t = new Date(m.kickoffAt).getTime();
		return isNaN(t) ? Infinity : t;
	}

	/** Earliest kickoff among all leaves under a subtree (defines its chrono rank) */
	function subtreeMinTime(id: string): number {
		const kids = CHILDREN.get(id);
		if (!kids) return matchTimeOf(id);
		return Math.min(...kids.filter((k): k is string => !!k).map(subtreeMinTime));
	}

	/**
	 * Leaf (R32) order under a subtree, top→bottom. At every node the two child
	 * subtrees are ordered by their earliest kickoff, so the column reads roughly
	 * chronologically (first matches on top) while the bracket tree — and its
	 * crossing-free connectors — stay intact.
	 */
	function leafOrderSorted(rootId: string): string[] {
		const out: string[] = [];
		const walk = (id: string) => {
			const kids = CHILDREN.get(id);
			if (!kids) { out.push(id); return; }
			const ordered = kids
				.filter((k): k is string => !!k)
				.slice()
				.sort((a, b) => subtreeMinTime(a) - subtreeMinTime(b));
			for (const k of ordered) walk(k);
		};
		walk(rootId);
		return out;
	}

	// Left half feeds sf-01, right half feeds sf-02 (true FIFA bracket halves).
	// Filled chronologically by computeBasePositions (dates come from `matches`).
	let LEFT_LEAVES: string[] = [];
	let RIGHT_LEAVES: string[] = [];

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
	let cardMeshes: { mesh: THREE.Mesh; shadow: THREE.Mesh; id: string; stage: string; delay: number; today: boolean }[] = [];
	let basePositions = new Map<string, { baseX: number; y: number; z: number; baseY: number }>();
	let connGroup = new THREE.Group();
	let glowMesh: THREE.Mesh | null = null;
	let winnerCurves: THREE.CubicBezierCurve3[] = [];
	let flowSprites: { sprite: THREE.Sprite; curve: THREE.CubicBezierCurve3; offset: number }[] = [];
	let pulseMeshes: THREE.Mesh[] = [];
	let contentGroup = new THREE.Group(); // holds everything rebuilt on resize

	// Lifecycle / animation state
	let destroyed = false;
	let firstFrameAt = 0; // ms timestamp of first rendered frame (for entrance + flow)
	const STAGE_INDEX: Record<string, number> = {
		round32: 0, round16: 1, quarterfinal: 2, semifinal: 3, thirdplace: 4, final: 4
	};
	// Shared resources created once and reused across rebuilds
	let dotTexture: THREE.CanvasTexture | null = null;
	const flowTmp = new THREE.Vector3();

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

		// Order each half chronologically (earliest matches on top)
		LEFT_LEAVES = leafOrderSorted('sf-01');
		RIGHT_LEAVES = leafOrderSorted('sf-02');

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

	/** True if the match is played today (viewer's local day) */
	function isToday(iso: string): boolean {
		if (!iso) return false;
		const d = new Date(iso);
		if (isNaN(d.getTime())) return false;
		const n = new Date();
		return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
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
		const today = isToday(match.kickoffAt);
		const winner: 'A' | 'B' | null = !hasResult
			? null
			: (match.scoreA! > match.scoreB! ? 'A' : match.scoreB! > match.scoreA! ? 'B' : (match.penaltyWinner ?? null));
		const stageColor = CARD_STAGE_CLR[match.stage] ?? '#64748b';
		const headerH = 22, r = 10;

		// Card body
		ctx.beginPath(); ctx.roundRect(0, 0, w, h, r);
		ctx.fillStyle = isFinal ? '#fffbeb' : '#ffffff'; ctx.fill();

		// Border priority: HOY (rojo) > terminado (verde) > final (ámbar) > normal
		let borderColor = '#e2e8f0', borderW = 1;
		if (isFinal) { borderColor = '#f59e0b'; borderW = 2; }
		if (hasResult) { borderColor = '#10b981'; borderW = 2; }
		if (today) { borderColor = '#ef4444'; borderW = 2.5; }
		ctx.strokeStyle = borderColor; ctx.lineWidth = borderW; ctx.stroke();

		// Header
		ctx.beginPath(); ctx.roundRect(0, 0, w, headerH, [r, r, 0, 0]);
		ctx.fillStyle = stageColor; ctx.fill();
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(CARD_STAGE_LBL[match.stage] ?? match.stage.toUpperCase(), 8, 15);

		// Kickoff date/time (right) + "HOY" pill when applicable
		const when = formatKickoff(match.kickoffAt);
		if (when) {
			ctx.font = '600 8.5px system-ui, -apple-system, sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(when, w - 8, 15);
			if (today) {
				const dw = ctx.measureText(when).width;
				const pillW = 21, pillH = 12, px = w - 8 - dw - 6 - pillW, py = (headerH - pillH) / 2;
				ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.roundRect(px, py, pillW, pillH, 3); ctx.fill();
				ctx.fillStyle = '#fff'; ctx.font = 'bold 7px system-ui, -apple-system, sans-serif'; ctx.textAlign = 'center';
				ctx.fillText('HOY', px + pillW / 2, py + pillH - 3.5);
			}
		}

		const top = headerH + 3;
		const rowH = (h - top - 4) / 2;

		for (let i = 0; i < 2; i++) {
			const y = top + i * rowH;
			const side: 'A' | 'B' = i === 0 ? 'A' : 'B';
			const name = i === 0 ? match.teamA : match.teamB;
			const score = i === 0 ? match.scoreA : match.scoreB;
			const flag = i === 0 ? flagA : flagB;
			const isWinner = winner === side;
			const isLoser = winner !== null && !isWinner;

			// Winner row: light green wash + left accent bar
			if (isWinner) {
				ctx.fillStyle = 'rgba(16,185,129,0.14)';
				ctx.fillRect(3, y, w - 6, rowH);
				ctx.fillStyle = '#10b981';
				ctx.fillRect(3, y + 2, 3, rowH - 4);
			}

			let tx = 10;
			if (flag) { try { ctx.drawImage(flag, 10, y + (rowH - 16) / 2, 24, 16); tx = 40; } catch { /* */ } }

			ctx.fillStyle = isWinner ? '#065f46' : isLoser ? '#94a3b8' : '#1e293b';
			ctx.font = `${isWinner ? '800' : '600'} 12px system-ui, -apple-system, sans-serif`;
			ctx.textAlign = 'left';
			ctx.fillText(name.length > 19 ? name.slice(0, 18) + '…' : name, tx, y + rowH / 2 + 4);

			ctx.fillStyle = hasResult ? (isWinner ? '#059669' : '#94a3b8') : '#cbd5e1';
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
		if (flagCache.has(name)) return flagCache.get(name) ?? null;
		const url = getFlagUrl(name, 40);
		if (!url) { flagCache.set(name, null); return null; }
		const img = await new Promise<HTMLImageElement | null>((r) => {
			const im = new Image(); im.crossOrigin = 'anonymous';
			im.onload = () => r(im); im.onerror = () => r(null); im.src = url;
		});
		flagCache.set(name, img);
		return img;
	}

	function createGlowTexture(rgb = '245,158,11', peak = 0.5): THREE.CanvasTexture {
		const c = document.createElement('canvas'); c.width = 256; c.height = 256;
		const ctx = c.getContext('2d')!;
		const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
		g.addColorStop(0, `rgba(${rgb},${peak})`);
		g.addColorStop(0.5, `rgba(${rgb},${peak * 0.24})`);
		g.addColorStop(1, `rgba(${rgb},0)`);
		ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
		return new THREE.CanvasTexture(c);
	}

	/** Soft round dot used for the energy particles that travel along the bracket */
	function getDotTexture(): THREE.CanvasTexture {
		if (dotTexture) return dotTexture;
		const c = document.createElement('canvas'); c.width = 64; c.height = 64;
		const ctx = c.getContext('2d')!;
		const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.35, 'rgba(186,230,253,0.95)');
		g.addColorStop(1, 'rgba(125,211,252,0)');
		ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
		dotTexture = new THREE.CanvasTexture(c);
		return dotTexture;
	}

	/** Vertical gradient backdrop for depth — modern, soft, light */
	function createBackgroundTexture(): THREE.CanvasTexture {
		const c = document.createElement('canvas'); c.width = 16; c.height = 256;
		const ctx = c.getContext('2d')!;
		const g = ctx.createLinearGradient(0, 0, 0, 256);
		g.addColorStop(0, '#eef4fb');
		g.addColorStop(0.55, '#e7eef8');
		g.addColorStop(1, '#dde7f4');
		ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}

	// ── Build connectors as a static tree (positions never change at runtime) ──
	// Winner paths use a per-stage colour gradient; the curves are kept so the
	// energy particles can travel along exactly the same lines.
	function rebuildConnectors() {
		connGroup = new THREE.Group();
		winnerCurves = [];

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
			winnerCurves.push(curve);

			const pts = curve.getPoints(28);
			const geo = new THREE.BufferGeometry().setFromPoints(pts);
			const cFrom = new THREE.Color(CARD_STAGE_CLR[stageOf(fromId)] ?? '#64748b');
			const cTo = new THREE.Color(CARD_STAGE_CLR[stageOf(toId)] ?? '#64748b');
			const colors = new Float32Array(pts.length * 3);
			for (let i = 0; i < pts.length; i++) {
				const c = cFrom.clone().lerp(cTo, i / (pts.length - 1));
				colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
			}
			geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
			const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 });
			connGroup.add(new THREE.Line(geo, mat));
		}

		for (const [fromId, toId] of LOSER_CONNS) {
			const fb = basePositions.get(fromId), tb = basePositions.get(toId);
			if (!fb || !tb) continue;
			const isL = fb.baseX < 0;
			const pts = [
				new THREE.Vector3(fb.baseX + (isL ? CARD_W / 2 : -CARD_W / 2), fb.baseY, fb.z),
				new THREE.Vector3(tb.baseX, tb.baseY, tb.z)
			];
			const dMat = new THREE.LineDashedMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.3, dashSize: 8, gapSize: 6 });
			const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dMat);
			l.computeLineDistances();
			connGroup.add(l);
		}
		contentGroup.add(connGroup);
	}

	/** Energy particles that flow along each winner path toward the next round */
	function buildFlowSprites() {
		const tex = getDotTexture();
		winnerCurves.forEach((curve, i) => {
			const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
			const sprite = new THREE.Sprite(mat);
			const s = Math.max(10, CARD_H * 0.42);
			sprite.scale.set(s, s, 1);
			sprite.renderOrder = 3;
			contentGroup.add(sprite);
			flowSprites.push({ sprite, curve, offset: (i * 0.1367) % 1 });
		});
	}

	/** Dispose every geometry/material/texture under an object (shared dot tex kept) */
	function disposeObject3D(obj: THREE.Object3D) {
		obj.traverse((o) => {
			const any = o as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
			any.geometry?.dispose();
			if (any.material) {
				const mats = Array.isArray(any.material) ? any.material : [any.material];
				for (const m of mats) {
					const map = (m as THREE.MeshBasicMaterial).map;
					if (map && map !== dotTexture) map.dispose();
					m.dispose();
				}
			}
		});
	}

	/** Remove + dispose all rebuildable content (cards, connectors, glow, particles) */
	function disposeContent() {
		for (const child of [...contentGroup.children]) {
			contentGroup.remove(child);
			disposeObject3D(child);
		}
		cardMeshes = [];
		flowSprites = [];
		pulseMeshes = [];
		glowMesh = null;
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

	function setCardSize(w: number) {
		CARD_W = Math.max(170, Math.min(280, w * 0.22));
		CARD_H = CARD_W * 0.35;
	}

	/** (Re)build everything that depends on card size / positions. Safe to re-run on resize. */
	function buildContent() {
		disposeContent();

		const bracketMatches = matches.filter((m) => m.stage !== 'groups');
		const started = firstFrameAt > 0; // skip the entrance animation on rebuilds (resize)

		for (const m of bracketMatches) {
			const bp = basePositions.get(m.id);
			if (!bp) continue;
			const today = isToday(m.kickoffAt);

			// Soft drop shadow
			const sMesh = new THREE.Mesh(
				new THREE.PlaneGeometry(CARD_W + 4, CARD_H + 4),
				new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: started ? 0.05 : 0, depthWrite: false })
			);
			sMesh.position.set(bp.baseX + 3, bp.y - 3, bp.z - 1);
			contentGroup.add(sMesh);

			// Pulsing halo behind matches played today
			if (today) {
				const halo = new THREE.Mesh(
					new THREE.PlaneGeometry(CARD_W * 1.6, CARD_H * 2.4),
					new THREE.MeshBasicMaterial({ map: createGlowTexture('239,68,68', 0.6), transparent: true, depthWrite: false, opacity: 0 })
				);
				halo.position.set(bp.baseX, bp.y, bp.z - 2);
				halo.userData.base = { x: bp.baseX, y: bp.y };
				contentGroup.add(halo);
				pulseMeshes.push(halo);
			}

			// The card itself
			const tex = createCardTexture(m, flagCache.get(m.teamA) ?? null, flagCache.get(m.teamB) ?? null);
			const mesh = new THREE.Mesh(
				new THREE.PlaneGeometry(CARD_W, CARD_H),
				new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: started ? 1 : 0 })
			);
			mesh.position.set(bp.baseX, bp.y, bp.z);
			mesh.renderOrder = 2;
			contentGroup.add(mesh);

			const delay = (STAGE_INDEX[m.stage] ?? 0) * 110;
			cardMeshes.push({ mesh, shadow: sMesh, id: m.id, stage: m.stage, delay, today });
		}

		// Trophy glow behind the final
		const fb = basePositions.get('final');
		if (fb) {
			glowMesh = new THREE.Mesh(
				new THREE.PlaneGeometry(CARD_W * 3, CARD_H * 5),
				new THREE.MeshBasicMaterial({ map: createGlowTexture('245,158,11', 0.55), transparent: true, depthWrite: false, opacity: started ? 1 : 0 })
			);
			glowMesh.position.set(0, fb.y, fb.z - 8);
			contentGroup.add(glowMesh);
		}

		rebuildConnectors();
		buildFlowSprites();
	}

	async function buildScene() {
		if (!container || destroyed) return;
		const w = container.clientWidth, h = container.clientHeight;
		setCardSize(w);
		computeBasePositions(w, h);

		renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(w, h);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		container.appendChild(renderer.domElement);

		scene = new THREE.Scene();
		scene.background = createBackgroundTexture();
		scene.fog = new THREE.Fog(0xe7eef8, initialCamZ * 0.6, initialCamZ + 1200);

		camera = new THREE.PerspectiveCamera(FOV_DEG, w / h, 10, initialCamZ + 2500);

		// Static ground grid (does not depend on card size)
		const grid = new THREE.Mesh(
			new THREE.PlaneGeometry(4200, 3000, 32, 24),
			new THREE.MeshBasicMaterial({ color: 0x94a3b8, wireframe: true, transparent: true, opacity: 0.05 })
		);
		grid.rotation.x = -Math.PI / 2;
		grid.position.set(0, -400, -700);
		scene.add(grid);
		scene.add(contentGroup);

		// Preload flags (cached across mounts), then build the size-dependent content
		const bracketMatches = matches.filter((m) => m.stage !== 'groups');
		const teams = new Set<string>();
		for (const m of bracketMatches) { teams.add(m.teamA); teams.add(m.teamB); }
		await Promise.all([...teams].map((t) => loadFlag(t)));
		if (destroyed) return;

		buildContent();

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

	const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

	function animate() {
		if (destroyed) return;
		animId = requestAnimationFrame(animate);
		if (!container || !renderer || !scene || !camera) return;

		const now = performance.now();
		if (!firstFrameAt) firstFrameAt = now;
		const elapsed = now - firstFrameAt;

		zoomT += (targetZoomT - zoomT) * 0.065;
		panX += (targetPanX - panX) * 0.08;
		panY += (targetPanY - panY) * 0.08;
		smoothGyro.x += (gyroOffset.x - smoothGyro.x) * 0.06;
		smoothGyro.y += (gyroOffset.y - smoothGyro.y) * 0.06;

		const camZ = getCamZ();

		// Entrance: cards fade + scale in, staggered front → back
		for (const c of cardMeshes) {
			const a = easeOut(Math.max(0, Math.min(1, (elapsed - c.delay) / 650)));
			const mat = c.mesh.material as THREE.MeshBasicMaterial;
			mat.opacity = a;
			c.mesh.scale.setScalar(0.9 + 0.1 * a);
			(c.shadow.material as THREE.MeshBasicMaterial).opacity = 0.05 * a;
		}
		const globalIn = easeOut(Math.max(0, Math.min(1, (elapsed - 250) / 800)));
		if (glowMesh) (glowMesh.material as THREE.MeshBasicMaterial).opacity = globalIn * (0.85 + 0.15 * Math.sin(elapsed * 0.0022));

		// Today halos pulse
		for (const halo of pulseMeshes) {
			const p = 0.5 + 0.5 * Math.sin(elapsed * 0.005);
			(halo.material as THREE.MeshBasicMaterial).opacity = globalIn * (0.22 + 0.3 * p);
			halo.scale.setScalar(0.97 + 0.1 * p);
		}

		// Energy particles flow along the winner paths toward the next round
		for (const f of flowSprites) {
			const t = ((elapsed * 0.00014 + f.offset) % 1 + 1) % 1;
			f.curve.getPoint(t, flowTmp);
			f.sprite.position.copy(flowTmp);
			(f.sprite.material as THREE.SpriteMaterial).opacity = globalIn * Math.sin(Math.PI * t) * 0.85;
		}

		// Depth fog tightens as you push toward the final
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
	let resizeTimer: ReturnType<typeof setTimeout> | null = null;
	function onResize() {
		if (!renderer || !container || !camera) return;
		const w = container.clientWidth, h = container.clientHeight;
		renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
		// Debounce the (heavier) content rebuild so dragging a desktop window stays smooth
		if (resizeTimer) clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			if (destroyed || !container) return;
			setCardSize(container.clientWidth);
			computeBasePositions(container.clientWidth, container.clientHeight);
			camera.far = initialCamZ + 2500; camera.updateProjectionMatrix();
			buildContent();
		}, 150);
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
		// onDestroy also runs during SSR teardown — bail out when there's no browser.
		if (typeof window === 'undefined') return;
		destroyed = true;
		if (animId) cancelAnimationFrame(animId);
		if (resizeTimer) clearTimeout(resizeTimer);
		window.removeEventListener('resize', onResize);
		window.removeEventListener('deviceorientation', onDeviceOrientation);
		if (scene) {
			if (scene.background instanceof THREE.Texture) scene.background.dispose();
			disposeObject3D(scene);
		}
		if (dotTexture) { dotTexture.dispose(); dotTexture = null; }
		if (renderer) {
			renderer.dispose();
			renderer.forceContextLoss?.();
			renderer.domElement.remove();
		}
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
