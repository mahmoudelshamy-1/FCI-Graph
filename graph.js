// ===== الألوان المستخرجة بدقة وتفتيحها مع ضبط البنفسجي الصريح =====
const COLORS = {
    Year1:  '#e2b3ff',  // البنفسجي الصريح والواضح مثل Polynomial Long Division
    Year2:  '#d6eaff',  // الأزرق السماوي الفاتح والمشرق
    IT:     '#bfffcc',  // الأخضر الليموني الفاتح المشرق
    IS:     '#ffe0b3',  // البرتقالي الدافئ الهادئ الفاتح
    CS:     '#befcfc',  // التركواز المشرق الفاتح (Cyan)
    Shared: '#cccccc'   // الرمادي الفاتح المريح للمواد العامة مثل Entrypoint
};

// اللون الأصفر الفاقع الأثقل ثنة عند تحديد المادة (بدون أي حواف)
const SELECTED_FILL = '#ffeb3b';     
const EDGE_COLOR = '#2b2b2b'; 

// ===== الأبعاد والسمك المحكوم للأشكال والأسهم الخفيفة =====
const NODE_RY = 22;            
const EDGE_WIDTH_DEFAULT = 0.65; // خط خفيف وناعم جداً كالموجود بالصور الافتراضية
const EDGE_WIDTH_THICK = 1.6;    // يثقل ثنة ليوضح المسار عند الضغط على المادة

let graphData = null;          
let nodeById = {};             
let selectedId = null;         
let svg = null;                
let gMain = null;              
let zoomBehavior = null;       
let linkSel = null, nodeSel = null; 
let width = 0, height = 0;     
let computedNodes = []; 

// دالة حساب العرض الأفقي (rx) بدقة لمنع تضخم الحجم وضمان عدم التداخل
function getDynamicRx(nodeId) {
    if (!nodeId) return 50;
    const text = String(nodeId);
    const lines = wrapText(text, 14); 
    const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, "");
    
    return Math.max(55, longestLine.length * 4.5 + 16);
}

// ===== بناء الـ Legend =====
function buildLegend() {
    const box = document.getElementById('legend-items');
    if (!box) return;
    const labels = { Year1: 'السنة الأولى', Year2: 'السنة الثانية', IT: 'تكنولوجيا المعلومات', IS: 'نظم المعلومات', CS: 'علوم الحاسب', Shared: 'مواد مشتركة' };
    box.innerHTML = Object.keys(COLORS).map(g =>
        `<div class="legend-row">
            <span class="legend-dot" style="background:${COLORS[g]}"></span>
            <span>${labels[g]}</span>
        </div>`
    ).join('');
}

function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escJs(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"'); }

// طي وتوزيع النص بشكل متناسق على سطرين داخل المحيط البيضاوي
function wrapText(text, maxChars) {
    const words = String(text).split(' ');
    if (text.length <= maxChars || words.length === 1) return [text];
    
    const lines = [];
    let line = '';
    for (let w of words) {
        if ((line + ' ' + w).trim().length > maxChars) {
            if (line) lines.push(line.trim());
            line = w;
        } else { line += ' ' + w; }
    }
    if (line) lines.push(line.trim());
    return lines.length > 2 ? [lines[0], lines.slice(1).join(' ')] : lines;
}

// حساب الرتب لتوزيع الخريطة عمودياً بشكل شجري متناسق
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
                if (rank[s] + 1 > rank[t]) { rank[t] = rank[s] + 1; changed = true; }
            }
        });
    }
    return rank;
}

function setupSvg() {
    const graphEl = document.getElementById('graph');
    width  = graphEl.clientWidth  || 800;
    height = graphEl.clientHeight || 600;

    graphEl.querySelector('svg')?.remove();
    svg = d3.select('#graph').append('svg')
        .attr('width', width)
        .attr('height', height);

    const defs = svg.append('defs');
    
    // 1) رأس السهم الافتراضي (صغير وخفيف)
    defs.append('marker')
        .attr('id', 'arrow-unified')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 7)  
        .attr('refY', 0)
        .attr('markerWidth', 6.5)    
        .attr('markerHeight', 6.5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-3L7,0L0,3')
        .attr('fill', EDGE_COLOR);

    // 2) رأس السهم المكبر سنة صغيرة للمسار المحدد
    defs.append('marker')
        .attr('id', 'arrow-unified-thick')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 7)  
        .attr('refY', 0)
        .attr('markerWidth', 9.0)    // تم تكبير الحجم هنا سنّة صغيرة
        .attr('markerHeight', 9.0)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-3L7,0L0,3')
        .attr('fill', EDGE_COLOR);

    gMain = svg.append('g').attr('class', 'g-main');
    gMain.append('g').attr('class', 'links');
    gMain.append('g').attr('class', 'nodes');

    zoomBehavior = d3.zoom()
        .scaleExtent([0.05, 4]) 
        .on('zoom', (event) => gMain.attr('transform', event.transform));

    svg.call(zoomBehavior);
    svg.style('touch-action', 'none');
}

// ضبط المسافات والأبعاد الهندسية لمنع التداخل تماماً وضمان المظهر المنظم
function prepareData() {
    const ranks = computeRanks();
    computedNodes = graphData.nodes.map(n => ({
        id: n.id, group: n.group, desc: n.desc, rank: ranks[n.id] || 0
    }));

    const idMap = {};
    computedNodes.forEach(n => { idMap[n.id] = n; });

    const byRank = {};
    computedNodes.forEach(n => { (byRank[n.rank] = byRank[n.rank] || []).push(n); });

    Object.keys(byRank).forEach(r => {
        const layer = byRank[r];
        const xStep = 250; 
        const totalLayerWidth = xStep * (layer.length - 1);
        const startX = (width - totalLayerWidth) / 2;

        layer.forEach((n, i) => {
            const offset = (r % 2 === 0) ? 30 : -30;
            n.x = startX + (i * xStep) + offset;
            
            const yStep = 175; 
            n.y = 100 + r * yStep;
        });
    });

    const links = graphData.links.map(l => {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        return { source: idMap[sId], target: idMap[tId], sourceId: sId, targetId: tId };
    }).filter(l => l.source && l.target);

    return { nodes: computedNodes, links };
}

function fitGraphToScreen() {
    if (!computedNodes || computedNodes.length === 0) return;
    
    const xs = computedNodes.map(n => n.x);
    const ys = computedNodes.map(n => n.y);
    
    const minX = Math.min(...xs) - 150;
    const maxX = Math.max(...xs) + 150;
    const minY = Math.min(...ys) - 100;
    const maxY = Math.max(...ys) + 100;
    
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    
    const scaleX = width / graphWidth;
    const scaleY = height / graphHeight;
    const scale = Math.min(scaleX, scaleY, 0.55); 
    
    const translateX = (width - graphWidth * scale) / 2 - minX * scale;
    const translateY = (height - graphHeight * scale) / 2 - minY * scale;
    
    svg.transition().duration(700).call(
        zoomBehavior.transform, 
        d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    );
}

function renderGraph() {
    setupSvg();
    const { nodes, links } = prepareData();

    // 1) رسم الروابط والأسهم بالسمك الخفيف الافتراضي
    linkSel = gMain.select('.links')
        .selectAll('path')
        .data(links)
        .join('path')
        .attr('stroke', EDGE_COLOR)
        .attr('stroke-width', EDGE_WIDTH_DEFAULT) 
        .attr('marker-end', 'url(#arrow-unified)') 
        .attr('fill', 'none')
        .attr('d', d => {
            const x1 = d.source.x, y1 = d.source.y;
            const x2 = d.target.x, y2 = d.target.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            const targetRx = getDynamicRx(d.target.id);
            const sourceRx = getDynamicRx(d.source.id);

            const targetX = x2 - targetRx * Math.cos(angle);
            const targetY = y2 - NODE_RY * Math.sin(angle);

            const sourceX = x1 + sourceRx * Math.cos(angle);
            const sourceY = y1 + NODE_RY * Math.sin(angle);

            const curvature = Math.min(0.28, 140 / dist); 
            
            const cpX1 = sourceX + dx * 0.05;
            const cpY1 = sourceY + dy * curvature;
            const cpX2 = targetX - dx * 0.05;
            const cpY2 = targetY - dy * curvature;

            return `M ${sourceX},${sourceY} C ${cpX1},${cpY1} ${cpX2},${cpY2} ${targetX},${targetY}`;
        });

    // 2) رسم المواد كأشكال بيضاوية (بدون حواف نهائياً stroke none)
    nodeSel = gMain.select('.nodes')
        .selectAll('g.node')
        .data(nodes, d => d.id)
        .join('g')
        .attr('class', 'node')
        .style('cursor', 'pointer')
        .attr('transform', d => `translate(${d.x},${d.y})`);

    nodeSel.append('ellipse')
        .attr('rx', d => getDynamicRx(d.id)) 
        .attr('ry', NODE_RY)
        .attr('fill', d => COLORS[d.group] || '#e3e3e3')
        .attr('stroke', 'none'); 

    // كتابة النص وضبط تباعد الخطوط والوزن المتوسط المتناسق
    nodeSel.each(function (d) {
        const lines = wrapText(d.id, 14); 
        const g = d3.select(this);
        
        const fontSize = lines.length > 1 ? "9px" : "9.5px";
        const txt = g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-family', 'system-ui, sans-serif')
            .attr('font-weight', '600') // تم ضبطه هنا ليكون Medium/Semi-Bold ممتاز ومريح للعين
            .attr('font-size', fontSize)
            .attr('fill', '#000000');
        
        if (lines.length === 1) {
            txt.append('tspan').attr('x', 0).attr('y', 0).text(lines[0]);
        } else {
            txt.append('tspan').attr('x', 0).attr('y', -5).text(lines[0]);
            txt.append('tspan').attr('x', 0).attr('y', 6).text(lines[1]);
        }
    });

    nodeSel.on('click', function (event, d) {
        event.stopPropagation();
        selectNode(d.id);
    });

    // تم حذف حدث الـ click من الـ svg هنا لمنع إعادة التعيين (Reset) عند الضغط في الفراغ

    fitGraphToScreen();
}

// تلوين المادة المختارة وعلاقاتها بالكامل بالأصفر الثقيل + تثقيل الأسهم وتكبير رأس السهم الخاصة بالمسار
function highlightPath(id) {
    if (!nodeSel || !linkSel) return;

    const prereqsSet = new Set();
    const prereqQueue = [id];
    while (prereqQueue.length) {
        const cur = prereqQueue.shift();
        graphData.links.forEach(l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            if (t === cur && !prereqsSet.has(s)) { prereqsSet.add(s); prereqQueue.push(s); }
        });
    }

    const unlocksSet = new Set();
    const unlockQueue = [id];
    while (unlockQueue.length) {
        const cur = unlockQueue.shift();
        graphData.links.forEach(l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            if (s === cur && !unlocksSet.has(t)) { unlocksSet.add(t); unlockQueue.push(t); }
        });
    }

    // 1) تلوين المواد المرتبطة بالأصفر الثقيل + وضع حواف للمادة المحددة كبست عليها فقط
    nodeSel.select('ellipse')
        .attr('fill', d => {
            if (d.id === id || prereqsSet.has(d.id) || unlocksSet.has(d.id)) return SELECTED_FILL;
            return COLORS[d.group] || '#e3e3e3';
        })
        .attr('stroke', d => {
            // المادة المحددة فقط تأخذ حدود بلون الحواف والباقي none
            return d.id === id ? EDGE_COLOR : 'none';
        })
        .attr('stroke-width', d => {
            // وضع سمك واضح للحافة للمادة المحددة فقط
            return d.id === id ? 2.5 : 0;
        });

    // 2) تثقيل الأسهم وتكبير رأس السهم للمسار المرتبط بالمادة فقط
    linkSel
        .attr('stroke-width', d => {
            const isSourceConnected = (d.sourceId === id || prereqsSet.has(d.sourceId) || unlocksSet.has(d.sourceId));
            const isTargetConnected = (d.targetId === id || prereqsSet.has(d.targetId) || unlocksSet.has(d.targetId));
            
            if (isSourceConnected && isTargetConnected) {
                return EDGE_WIDTH_THICK;
            }
            return EDGE_WIDTH_DEFAULT;
        })
        .attr('marker-end', d => {
            const isSourceConnected = (d.sourceId === id || prereqsSet.has(d.sourceId) || unlocksSet.has(d.sourceId));
            const isTargetConnected = (d.targetId === id || prereqsSet.has(d.targetId) || unlocksSet.has(d.targetId));
            
            // إذا كان السهم يقع ضمن المسار المحدد، نغير الـ marker للرأس المكبّر
            if (isSourceConnected && isTargetConnected) {
                return 'url(#arrow-unified-thick)';
            }
            return 'url(#arrow-unified)';
        });
}

function selectNode(id) {
    selectedId = id;
    const node = nodeById[id];
    if (!node) return;
    updateInfoPanel(node);
    highlightPath(id);
}

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
    let html = node.desc ? `<div id="infoPanel-desc">${escHtml(node.desc)}</div>` : '';

    if (prereqs.length) {
        html += `<div class="info-section"><div class="info-section-title">⬅️ المتطلبات السابقة</div>`;
        html += `<div>${prereqs.map(p => `<span class="pill" onclick="selectNode('${escJs(p)}')">${escHtml(p)}</span>`).join('')}</div></div>`;
    }
    if (unlocks.length) {
        html += `<div class="info-section"><div class="info-section-title">➡️ يؤهلك لدراسة</div>`;
        html += `<div>${unlocks.map(u => `<span class="pill" onclick="selectNode('${escJs(u)}')">${escHtml(u)}</span>`).join('')}</div></div>`;
    }
    bodyEl.innerHTML = html;
}

function resetView() {
    selectedId = null;
    renderGraph();
    document.getElementById('infoPanel-title').innerHTML = 'خريطة المواد';
    document.getElementById('infoPanel-body').innerHTML = '<div style="text-align:center; color:#888; margin-top:40px;">👆 اضغط على أي مادة لعرض تفاصيلها</div>';
}

function toggleLegend() {
    const lg = document.getElementById('legend');
    if (lg) lg.style.display = lg.style.display === 'none' ? 'block' : 'none';
}

window.selectNode = selectNode; window.resetView = resetView; window.toggleLegend = toggleLegend;
buildLegend();

d3.json('graph.json').then(function (data) {
    graphData = data;
    data.nodes.forEach(n => { nodeById[n.id] = n; });
    renderGraph();
}).catch(err => console.error(err));