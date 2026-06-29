

const COLORS = {
    Year1:  '#ffdbdb',  // أحمر فاتح
    Year2:  '#c9e4ff',  // أزرق فاتح
    IT:     '#bdffc8',  // أخضر فاتح
    IS:     '#ffe19c',  // برتقالي فاتح
    CS:     '#f0c9ff',  // بنفسجي فاتح
    Shared: '#b0fff6'   // تركواز فاتح
};

const GROUP_LABELS = {
    Year1:  'السنة الأولى',
    Year2:  'السنة الثانية',
    IT:     'تكنولوجيا المعلومات',
    IS:     'نظم المعلومات',
    CS:     'علوم الحاسب',
    Shared: 'مواد مشتركة'
};

// ===== ثوابت بصرية للعقد والحواف =====
const NODE_RX = 38;            // نصف قطر أفقي مريح للنصوص
const NODE_RY = 24;            // نصف قطر رأسي مريح للنصوص
const EDGE_COLOR = '#888';     // لون الأسهم الافتراضي
const EDGE_WIDTH = 1.8;        // زيادة سُمك السهم لتحسين الرؤية والقراءة

// ألوان التحديد الموحدة (أصفر / ذهبي لكل المسارات)
const SELECTED_FILL = '#f6ff4f';     // لون تعبئة المادة المختارة نفسها
const SELECTED_STROKE = '#d5df1e';   // لون حدود المادة المختارة والمسارات بالكامل

// ===== حدود الـ Zoom المطلوبة =====
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

// ===== متغيرات الحالة العامة =====
let graphData = null;          
let nodeById = {};             
let selectedId = null;         
let svg = null;                
let gMain = null;              
let zoomBehavior = null;       
let linkSel = null, nodeSel = null; 
let width = 0, height = 0;     
let computedNodes = []; // لتخزين العقد بمواضعها الثابتة

// ===== بناء الـ legend =====
function buildLegend() {
    const box = document.getElementById('legend-items');
    if (!box) return;
    box.innerHTML = Object.keys(COLORS).map(g =>
        `<div class="legend-row">
            <span class="legend-dot" style="background:${COLORS[g]}"></span>
            <span>${GROUP_LABELS[g]}</span>
        </div>`
    ).join('');
}

// ===== دوال escape =====
function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function escJs(s) {
    return String(s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

// ===== طي نص المادة بطريقة ذكية ومتوافقة مع الحروف العربية =====
function wrapText(text, maxChars) {
    const words = String(text).split(' ');
    if (text.length <= maxChars || words.length === 1) {
        return [text];
    }
    
    const lines = [];
    let line = '';
    
    for (let w of words) {
        if ((line + ' ' + w).trim().length > maxChars) {
            if (line) lines.push(line.trim());
            line = w;
        } else {
            line += ' ' + w;
        }
    }
    if (line) lines.push(line.trim());
    
    if (lines.length > 2) {
        return [lines[0], lines.slice(1).join(' ')];
    }
    return lines;
}

// ===== حساب الترتيب الهرمي الثابت (Rank) =====
function computeRanks() {
    const rank = {};
    graphData.nodes.forEach(n => { rank[n.id] = 0; });

    let changed = true, iter = 0;
    while (changed && iter < 200) {
        changed = false; iter++;
        graphData.links.forEach(l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            if (rank[s] !== undefined && rank[t] !== undefined) {
                if (rank[s] + 1 > rank[t]) {
                    rank[t] = rank[s] + 1;
                    changed = true;
                }
            }
        });
    }
    return rank;
}

// ===== قياس أبعاد منطقة الرسم =====
function measure() {
    const graphEl = document.getElementById('graph');
    width  = graphEl.clientWidth  || graphEl.offsetWidth  || 800;
    height = graphEl.clientHeight || graphEl.offsetHeight || 600;
}

// ===== بناء هيكل SVG وخدمات التكبير والسحب التعريفية =====
function setupSvg() {
    measure();

    document.getElementById('graph').querySelector('svg')?.remove();
    svg = d3.select('#graph').append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const defs = svg.append('defs');
    
    // سهم افتراضي رمادي
    defs.append('marker')
        .attr('id', 'arrow-default')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', NODE_RX + 7) 
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', EDGE_COLOR);

    // سهم مبرز للمسارات النشطة باللون الأصفر/الذهبي
    defs.append('marker')
        .attr('id', 'arrow-selected')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', NODE_RX + 7)
        .attr('refY', 0)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', SELECTED_STROKE);

    gMain = svg.append('g').attr('class', 'g-main');
    gMain.append('g').attr('class', 'links');
    gMain.append('g').attr('class', 'nodes');

    zoomBehavior = d3.zoom()
        .scaleExtent([ZOOM_MIN, ZOOM_MAX])
        .on('zoom', (event) => {
            gMain.attr('transform', event.transform);
        });

    svg.call(zoomBehavior);
    svg.style('touch-action', 'none');
}

// ===== تهيئة وحساب الإحداثيات الثابتة تماماً =====
function prepareData() {
    const ranks = computeRanks();
    const maxRank = Math.max(0, ...Object.values(ranks));

    computedNodes = graphData.nodes.map(n => ({
        id: n.id,
        group: n.group,
        desc: n.desc,
        rank: ranks[n.id] || 0
    }));

    const idMap = {};
    computedNodes.forEach(n => { idMap[n.id] = n; });

    const byRank = {};
    computedNodes.forEach(n => {
        (byRank[n.rank] = byRank[n.rank] || []).push(n);
    });

    Object.keys(byRank).forEach(r => {
        const layer = byRank[r];
        const xStep = Math.max(140, width / (layer.length + 1));
        const totalLayerWidth = xStep * (layer.length - 1);
        const startX = (width - totalLayerWidth) / 2;

        layer.forEach((n, i) => {
            n.x = startX + (i * xStep);
            const yStep = Math.max(110, (height - 140) / Math.max(1, maxRank));
            n.y = 70 + r * yStep;
        });
    });

    const links = graphData.links.map(l => {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        return {
            source: idMap[sId],
            target: idMap[tId],
            sourceId: sId,
            targetId: tId
        };
    }).filter(l => l.source && l.target);

    return { nodes: computedNodes, links };
}

// ===== رسم العناصر الثابتة =====
function renderNodesLinks(nodes, links) {
    // 1) رسم الروابط
    linkSel = gMain.select('.links')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', EDGE_COLOR)
        .attr('stroke-width', EDGE_WIDTH)
        .attr('marker-end', 'url(#arrow-default)')
        .attr('fill', 'none')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

    // 2) رسم العقد
    nodeSel = gMain.select('.nodes')
        .selectAll('g.node')
        .data(nodes, d => d.id)
        .join('g')
        .attr('class', 'node')
        .style('cursor', 'pointer')
        .attr('transform', d => `translate(${d.x},${d.y})`);

    nodeSel.append('ellipse')
        .attr('rx', NODE_RX)
        .attr('ry', NODE_RY)
        .attr('fill', d => COLORS[d.group] || '#e3e3e3')
        .attr('stroke', '#333')
        .attr('stroke-width', 1.2);

    nodeSel.each(function (d) {
        const lines = wrapText(d.id, 11);
        const g = d3.select(this);
        g.selectAll('text').remove();
        
        const fontSize = lines.length > 1 ? 9.5 : 10.5;
        
        const txt = g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-family', '"Segoe UI", Tahoma, sans-serif')
            .attr('font-weight', '500')
            .attr('font-size', fontSize)
            .attr('fill', '#1a1a1a')
            .attr('pointer-events', 'none');
        
        if (lines.length === 1) {
            txt.append('tspan').attr('x', 0).attr('y', 0).text(lines[0]);
        } else {
            txt.append('tspan').attr('x', 0).attr('y', -6).text(lines[0]);
            txt.append('tspan').attr('x', 0).attr('y', 8).text(lines[1]);
        }
    });

    nodeSel.on('click', function (event, d) {
        event.stopPropagation();
        selectNode(d.id);
    });
}

function renderGraph() {
    setupSvg();
    const { nodes, links } = prepareData();
    renderNodesLinks(nodes, links);
}

function selectNode(id) {
    selectedId = id;
    const node = nodeById[id];
    if (!node) return;

    updateInfoPanel(node);
    highlightPath(id);
}

// ===== تلوين العلاقات السابقة والمستقبلية باللون الأصفر الموحد بنجاح تام وبدون تداخل ألوان =====
function highlightPath(id) {
    if (!nodeSel || !linkSel) return;

    // إعادة تعيين الألوان والحالات للشكل الافتراضي أولاً
    nodeSel.select('ellipse')
        .attr('fill', d => COLORS[d.group] || '#e3e3e3')
        .attr('stroke', '#333')
        .attr('stroke-width', 1.2);
    linkSel
        .attr('stroke', EDGE_COLOR)
        .attr('stroke-width', EDGE_WIDTH)
        .attr('marker-end', 'url(#arrow-default)');

    // 1. تجميع المتطلبات السابقة (المواد اللي تدرسها قبلها - صعوداً)
    const prereqsSet = new Set();
    const prereqQueue = [id];
    while (prereqQueue.length) {
        const cur = prereqQueue.shift();
        graphData.links.forEach(l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            if (t === cur && !prereqsSet.has(s)) {
                prereqsSet.add(s);
                prereqQueue.push(s);
            }
        });
    }

    // 2. تجميع المواد المستقبلية (المواد اللي تؤهلك ليها - هبوطاً)
    const unlocksSet = new Set();
    const unlockQueue = [id];
    while (unlockQueue.length) {
        const cur = unlockQueue.shift();
        graphData.links.forEach(l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            if (s === cur && !unlocksSet.has(t)) {
                unlocksSet.add(t);
                unlockQueue.push(t);
            }
        });
    }

    // 3. تلوين كل العقد المتصلة بالمسارين (خلفية صفراء خفيفة متناسقة مع لون التحديد)
    nodeSel.select('ellipse').attr('fill', d => {
        if (d.id === id) return SELECTED_FILL; // المادة المحددة نفسها
        if (prereqsSet.has(d.id) || unlocksSet.has(d.id)) return '#f6ff4f'; // لون أصفر خفيف ومريح للعين للمسارات المتصلة
        return COLORS[d.group] || '#e3e3e3';
    })
    .attr('stroke', d => {
        if (d.id === id || prereqsSet.has(d.id) || unlocksSet.has(d.id)) return SELECTED_STROKE;
        return '#333';
    })
    .attr('stroke-width', d => (d.id === id ? 3 : (prereqsSet.has(d.id) || unlocksSet.has(d.id) ? 2 : 1.2)));

    // 4. تلوين كل الأسهم والروابط باللون الأصفر الموحد
    linkSel.each(function(d) {
        const srcId = d.sourceId || (d.source && d.source.id) || d.source;
        const tgtId = d.targetId || (d.target && d.target.id) || d.target;
        
        const line = d3.select(this);
        
        // التحقق مما إذا كان السهم يقع ضمن مسار المواد السابقة أو اللاحقة للمادة الحالية
        const isPrereqPath = (tgtId === id || prereqsSet.has(tgtId)) && prereqsSet.has(srcId);
        const isUnlockPath = (srcId === id || unlocksSet.has(srcId)) && unlocksSet.has(tgtId);

        if (isPrereqPath || isUnlockPath) {
            line.attr('stroke', SELECTED_STROKE)
                .attr('stroke-width', 2.5)
                .attr('marker-end', 'url(#arrow-selected)'); // تطبيق رأس السهم الأصفر الموحد
        }
    });
}

// ===== تحديث محتوى السايدبار =====
function updateInfoPanel(node) {
    const titleEl = document.getElementById('infoPanel-title');
    const bodyEl = document.getElementById('infoPanel-body');
    if (!titleEl || !bodyEl) return;

    const prereqs = [];
    const unlocks = [];
    graphData.links.forEach(l => {
        const s = l.source.id || l.source;
        const t = l.target.id || l.target;
        if (t === node.id) prereqs.push(s);
        if (s === node.id) unlocks.push(t);
    });

    titleEl.innerHTML = escHtml(node.id);

    let html = '';
    if (node.desc) {
        html += `<div id="infoPanel-desc">${escHtml(node.desc)}</div>`;
    }

    if (prereqs.length) {
        html += `<div class="info-section">
            <div class="info-section-title">⬅️ المتطلبات السابقة</div>
            <div>${prereqs.map(p => `<span class="pill" onclick="selectNode('${escJs(p)}')">${escHtml(p)}</span>`).join('')}</div>
        </div>`;
    }

    if (unlocks.length) {
        html += `<div class="info-section">
            <div class="info-section-title">➡️ يؤهلك لدراسة</div>
            <div>${unlocks.map(u => `<span class="pill" onclick="selectNode('${escJs(u)}')">${escHtml(u)}</span>`).join('')}</div>
        </div>`;
    }

    html += `<div class="info-section">
        <div class="info-section-title">📚 محتوى المادة</div>
        <div class="content-empty">سيتم إضافة محتوى هذه المادة قريباً.</div>
    </div>`;

    bodyEl.innerHTML = html;
}

// ===== إعادة ضبط الجراف الافتراضي والـ Zoom والواجهة =====
function resetView() {
    selectedId = null;
    renderGraph();
    if (svg && zoomBehavior) {
        svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity);
    }
    const titleEl = document.getElementById('infoPanel-title');
    const bodyEl = document.getElementById('infoPanel-body');
    if (titleEl) titleEl.innerHTML = 'خريطة المواد';
    if (bodyEl) {
        bodyEl.innerHTML =
            '<div style="text-align:center; color:#888; margin-top:40px;">👆 اضغط على أي مادة لعرض تفاصيلها</div>';
    }
}

function zoomIn() {
    if (svg && zoomBehavior) svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.3);
}
function zoomOut() {
    if (svg && zoomBehavior) svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.7);
}

function toggleLegend() {
    const lg = document.getElementById('legend');
    if (lg) lg.style.display = lg.style.display === 'none' ? 'block' : 'none';
}

let resizeTimer = null;
function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        renderGraph();
        if (selectedId) highlightPath(selectedId);
    }, 200);
}

window.selectNode = selectNode;
window.resetView = resetView;
window.toggleLegend = toggleLegend;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;

buildLegend();

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

d3.json('graph.json').then(function (data) {
    graphData = data;
    data.nodes.forEach(function (n) { nodeById[n.id] = n; });
    renderGraph();
}).catch(function (err) {
    const graphEl = document.getElementById('graph');
    if (graphEl) {
        graphEl.innerHTML =
            '<div style="padding:40px;color:#c00;">تعذر تحميل graph.json — تأكد من تشغيل السيرفر المحلي</div>';
    }
    console.error(err);
});