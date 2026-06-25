// ====== FCI Knowledge Graph (Graphviz + JustinMath style) ======

// ألوان باستيل فاتحة زي JustinMath بالظبط
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

let graphData = null;
let nodeById = {};
let dotSrc = '';
let selectedId = null;

// ===== بناء الـ legend =====
function buildLegend() {
    const box = document.getElementById('legend-items');
    box.innerHTML = Object.keys(COLORS).map(g =>
        `<div class="legend-row">
            <span class="legend-dot" style="background:${COLORS[g]}"></span>
            <span>${GROUP_LABELS[g]}</span>
        </div>`
    ).join('');
}

// ===== تحويل النص لآمن لـ Graphviz DOT (escaping) =====
function esc(s) {
    return String(s)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/&/g, '&amp;');
}

// ===== تحويل النص لآمن لـ HTML =====
function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ===== تحويل النص لآمن لـ JavaScript string (onclick) =====
function escJs(s) {
    return String(s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

// ===== طي النص الطويل لسطور متعددة =====
function wrapLabel(text, maxChars = 18) {
    const words = String(text).split(' ');
    let result = '', line = '';
    for (let w of words) {
        if ((line + ' ' + w).trim().length > maxChars) {
            result += line.trim() + '\\n';
            line = w;
        } else {
            line += ' ' + w;
        }
    }
    result += line.trim();
    return result;
}

// ===== Attributer: ضبط أبعاد الـ SVG (زي JustinMath بالظبط) =====
function attributer(datum, index, nodes) {
    if (datum.tag === "svg") {
        var graphEl = document.getElementById("graph");
        var width = graphEl.clientWidth || graphEl.offsetWidth || 800;
        var height = graphEl.clientHeight || graphEl.offsetHeight || 600;
        datum.attributes.width = width;
        datum.attributes.height = height;
    }
}

// ===== بناء DOT من graph.json =====
function buildDot() {
    const lines = [];
    // إعدادات الجراف (أتربيوت واحدة في براكيت واحد — صيغة DOT الصحيحة)
    lines.push('digraph {');
    lines.push('  graph [rankdir=BT, newrank=true, overlap=false, nodesep=0.4, ranksep=0.9, splines=true, bgcolor="transparent", dpi=72];');
    lines.push('  node [shape=ellipse, style="filled", fontname="Segoe UI", fontsize=14, fontcolor="#1a1a1a", penwidth=0, color="#333"];');
    lines.push('  edge [arrowsize=1.2, color="#666", penwidth=1.1];');

    // العقد
    graphData.nodes.forEach(n => {
        const fill = COLORS[n.group] || '#e3e3e3';
        const label = wrapLabel(n.id);
        const desc = n.desc ? ` tooltip="${esc(n.desc)}"` : '';
        lines.push(`  "${esc(n.id)}" [label="${label}", fillcolor="${fill}"${desc}];`);
    });

    // الروابط
    graphData.links.forEach(l => {
        lines.push(`  "${esc(l.source)}" -> "${esc(l.target)}";`);
    });

    lines.push('}');
    return lines.join('\n');
}

// ===== إعادة رسم الجراف =====
function renderGraph() {
    dotSrc = buildDot();
    d3.select("#graph")
        .graphviz()
        .attributer(attributer)
        .transition(function () {
            return d3.transition().duration(400);
        })
        .logEvents(false)
        .renderDot(dotSrc)
        .on("end", function () {
            attachInteractions();
        });
}

// ===== ربط التفاعلات بعد الرسم =====
function attachInteractions() {
    d3.selectAll('.node').on('click', function () {
        const title = d3.select(this).select('title').text();
        selectNode(title);
    });
}

// ===== تحديد عقدة + إبراز مسار المتطلبات =====
function selectNode(id) {
    selectedId = id;
    const node = nodeById[id];
    if (!node) return;

    updateInfoPanel(node);
    highlightPath(id);
}

// ===== إبراز مسار المتطلبات (من الأجداد للمادة) =====
function highlightPath(id) {
    // إعادة الكل للطبيعي
    d3.select("#graph svg").selectAll('.node').each(function () {
        d3.select(this).select('ellipse')
            .attr('stroke-width', 0)
            .attr('stroke', '#333');
    });
    d3.select("#graph svg").selectAll('.edge').each(function () {
        d3.select(this).select('path')
            .attr('stroke', '#666')
            .attr('stroke-width', 1.1);
        d3.select(this).select('polygon')
            .attr('stroke', '#666')
            .attr('fill', '#666');
    });

    // تجميع كل الأجداد (Prerequisites) صعوداً
    const ancestors = new Set([id]);
    const queue = [id];
    while (queue.length) {
        const cur = queue.shift();
        graphData.links.forEach(l => {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            if (t === cur && !ancestors.has(s)) {
                ancestors.add(s);
                queue.push(s);
            }
        });
    }

    // إبراز العقد في المسار
    d3.select("#graph svg").selectAll('.node').each(function () {
        const nid = d3.select(this).select('title').text();
        if (ancestors.has(nid)) {
            d3.select(this).select('ellipse')
                .attr('fill', '#f6ff4f')
                .attr('stroke', '#d4a017')
                .attr('stroke-width', nid === id ? 3 : 1.5);
        }
    });

    // إبراز حواف المسار
    d3.select("#graph svg").selectAll('.edge').each(function () {
        const title = d3.select(this).select('title').text();
        const [src, tgt] = title.split('->');
        if (ancestors.has(src.trim()) && ancestors.has(tgt.trim())) {
            d3.select(this).select('path')
                .attr('stroke', '#d4a017')
                .attr('stroke-width', 2.5);
            d3.select(this).select('polygon')
                .attr('stroke', '#d4a017')
                .attr('fill', '#d4a017');
        }
    });
}

// ===== تحديث محتوى السايدبار =====
function updateInfoPanel(node) {
    const titleEl = document.getElementById('infoPanel-title');
    const bodyEl = document.getElementById('infoPanel-body');

    // المتطلبات السابقة + المواد التالية
    const prereqs = [];
    const unlocks = [];
    graphData.links.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (t === node.id) prereqs.push(s);
        if (s === node.id) unlocks.push(t);
    });

    titleEl.innerHTML = escHtml(node.id);

    let html = '';
    if (node.desc) {
        html += `<div id="infoPanel-desc">${node.desc}</div>`;
    }

    // المتطلبات السابقة
    if (prereqs.length) {
        html += `<div class="info-section">
            <div class="info-section-title">⬅️ المتطلبات السابقة</div>
            <div>${prereqs.map(p => `<span class="pill" onclick="selectNode('${escJs(p)}')">${escHtml(p)}</span>`).join('')}</div>
        </div>`;
    }

    // المواد التالية
    if (unlocks.length) {
        html += `<div class="info-section">
            <div class="info-section-title">➡️ يؤهلك لدراسة</div>
            <div>${unlocks.map(u => `<span class="pill" onclick="selectNode('${escJs(u)}')">${escHtml(u)}</span>`).join('')}</div>
        </div>`;
    }

    // محتوى المادة (فاضي دلوقتي — هيتضاف بكره)
    html += `<div class="info-section">
        <div class="info-section-title">📚 محتوى المادة</div>
        <div class="content-empty">سيتم إضافة محتوى هذه المادة قريباً.</div>
    </div>`;

    bodyEl.innerHTML = html;
}

// ===== إعادة ضبط العرض =====
function resetView() {
    selectedId = null;
    renderGraph();
    document.getElementById('infoPanel-title').innerHTML = 'خريطة المواد';
    document.getElementById('infoPanel-body').innerHTML =
        '<div style="text-align:center; color:#888; margin-top:40px;">👆 اضغط على أي مادة لعرض تفاصيلها</div>';
}

function toggleLegend() {
    const lg = document.getElementById('legend');
    lg.style.display = lg.style.display === 'none' ? 'block' : 'none';
}

// ===== البدء =====
window.selectNode = selectNode;
window.resetView = resetView;
window.toggleLegend = toggleLegend;

buildLegend();

d3.json("graph.json").then(function (data) {
    graphData = data;
    data.nodes.forEach(function (n) { nodeById[n.id] = n; });
    renderGraph();
}).catch(function (err) {
    document.getElementById('graph').innerHTML =
        '<div style="padding:40px;color:#c00;">تعذر تحميل graph.json — تأكد من تشغيل السيرفر المحلي</div>';
    console.error(err);
});
