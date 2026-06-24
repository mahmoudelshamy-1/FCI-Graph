const svg = d3.select("svg");

const width = window.innerWidth;
const height = window.innerHeight;

// ألوان كل مجموعة (سنة / تخصص / مشترك)
const color = d3.scaleOrdinal()
    .domain(["Year1", "Year2", "IT", "IS", "CS", "Shared"])
    .range(["#e74c3c", "#9b59b6", "#2ecc71", "#f1c40f", "#3498db", "#1abc9c"]);

// الطبقة القابلة للتكبير / التحريك
const g = svg.append("g");
const zoom = d3.zoom()
    .scaleExtent([0.2, 4])
    .on("zoom", (event) => g.attr("transform", event.transform));
svg.call(zoom);

// صندوق الوصف السريع عند الـ hover
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// الـ legend
const legendData = [
    { group: "Year1",  label: "السنة الأولى" },
    { group: "Year2",  label: "السنة الثانية" },
    { group: "IT",     label: "تكنولوجيا المعلومات" },
    { group: "IS",     label: "نظم المعلومات" },
    { group: "CS",     label: "علوم الحاسب" },
    { group: "Shared", label: "مواد مشتركة" }
];
const legendBox = d3.select("#legend");
legendData.forEach(d => {
    const row = legendBox.append("div").attr("class", "legend-row");
    row.append("span").attr("class", "legend-dot").style("background", color(d.group));
    row.append("span").text(d.label);
});

// أسماء المجموعات بالعربي للبانل
const groupLabels = {
    "Year1": "السنة الأولى", "Year2": "السنة الثانية",
    "IT": "تكنولوجيا المعلومات", "IS": "نظم المعلومات",
    "CS": "علوم الحاسب", "Shared": "مادة مشتركة"
};

// حجم الكور بيعتمد على طول اسم المادة (عشان الاسم يتسع جواها)
function nodeRadius(d) {
    return Math.max(32, d.id.length * 4.2 + 14);
}

d3.json("graph.json").then(data => {

    const nodeById = {};
    data.nodes.forEach(n => nodeById[n.id] = n);

    // مجموعات الرسم
    const linkG  = g.append("g").attr("class", "links");
    const nodeG  = g.append("g").attr("class", "nodes");
    const labelG = g.append("g").attr("class", "labels");

    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links).id(d => d.id)
            .distance(d => (nodeRadius(d.source) + nodeRadius(d.target)) * 1.1)
            .strength(0.35))
        .force("charge", d3.forceManyBody().strength(-1500))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => nodeRadius(d) + 8))
        .force("x", d3.forceX(width / 2).strength(0.04))
        .force("y", d3.forceY(height / 2).strength(0.04));

    simulation.on("tick", () => {
        linkG.selectAll("line")
            .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nodeG.selectAll("circle")
            .attr("cx", d => d.x).attr("cy", d => d.y);
        labelG.selectAll("text")
            .attr("x", d => d.x).attr("y", d => d.y);
    });

    // ----- الروابط -----
    linkG.selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("stroke", "#666")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 1.6);

    // ----- الكور -----
    const node = nodeG.selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("r", nodeRadius)
        .attr("fill", d => color(d.group))
        .attr("fill-opacity", 0.9)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .style("transition", "transform 0.2s ease")
        .on("mouseover", function (event, d) {
            d3.select(this).attr("stroke-width", 4);
            showTooltip(event, d);
            fade(0.15)(event, d);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", function (event, d) {
            d3.select(this).attr("stroke-width", 2);
            tooltip.transition().duration(200).style("opacity", 0);
            fade(1)(event, d);
        })
        .on("click", function (event, d) {
            openPanel(d);
        })
        .call(d3.drag()
            .on("start", dragStart)
            .on("drag", dragDrag)
            .on("end", dragEnd));

    // ----- التسميات (الاسم جوه الكورة) -----
    // حجم الخط بيكبر ويصغر مع حجم الكورة
    labelG.selectAll("text")
        .data(data.nodes)
        .enter().append("text")
        .attr("class", "node-label")
        .text(d => d.id)
        .each(function (d) {
            // نضبط حجم الخط حسب نصف قطر الكورة ونطوى الاسم لو طويل
            const r = nodeRadius(d);
            let fontSize = Math.max(9, r * 0.36);
            // لو الاسم أطول من قطر الكورة، نصغر الخط لحد ما يتسع
            const maxChars = Math.floor((r * 2) / (fontSize * 0.58));
            if (d.id.length > maxChars) {
                fontSize = Math.max(8, (r * 2) / (d.id.length * 0.58));
            }
            d3.select(this).attr("font-size", fontSize);
        })
        .attr("text-anchor", "middle")
        .attr("dy", "0.34em")
        .attr("fill", "#fff")
        .attr("font-weight", "bold")
        .attr("font-family", "Segoe UI, Tahoma, Arial, sans-serif")
        .style("pointer-events", "none")
        .style("paint-order", "stroke")
        .attr("stroke", "rgba(0,0,0,0.5)")
        .attr("stroke-width", "0.5px")
        .attr("paint-order", "stroke");

    // إبراز الجيران عند الـ hover
    function fade(opacity) {
        return (event, d) => {
            const neighbors = new Set([d.id]);
            data.links.forEach(l => {
                if (l.source.id === d.id) neighbors.add(l.target.id);
                if (l.target.id === d.id) neighbors.add(l.source.id);
            });
            nodeG.selectAll("circle").style("opacity", o => neighbors.has(o.id) ? 1 : opacity);
            labelG.selectAll("text").style("opacity", o => neighbors.has(o.id) ? 1 : opacity);
            linkG.selectAll("line").style("stroke-opacity", o =>
                (o.source.id === d.id || o.target.id === d.id) ? 0.9 : opacity * 0.3);
        };
    }

    function showTooltip(event, d) {
        tooltip.transition().duration(120).style("opacity", 0.95);
        tooltip.html(`<b>${d.id}</b>${d.desc ? `<br/>${d.desc}` : ""}`)
            .style("left", (event.pageX + 14) + "px")
            .style("top", (event.pageY - 30) + "px");
    }
    function moveTooltip(event) {
        tooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 30) + "px");
    }

    // ====== البانل الجانبي لعرض محتوى المادة ======
    function openPanel(d) {
        const panel = document.getElementById("detail-panel");
        const content = document.getElementById("detail-content");

        // المتطلبات السابقة (الجيران اللي مرتبطة بالمادة)
        const prereqs = [];
        data.links.forEach(l => {
            if (l.target.id === d.id) prereqs.push(l.source.id);
        });
        const unlocks = [];
        data.links.forEach(l => {
            if (l.source.id === d.id) unlocks.push(l.target.id);
        });

        const items = d.content || [];
        const hasContent = items.length > 0;

        content.innerHTML = `
            <button class="close-btn" onclick="closePanel()">×</button>
            <div class="breadcrumb">${groupLabels[d.group] || ""}</div>
            <h2 class="detail-title">${d.id}</h2>
            ${d.desc ? `<div class="detail-desc">${d.desc}</div>` : ""}

            ${hasContent ? `
                <div class="detail-section-title">محتوى المادة</div>
                <div class="content-list">
                    ${items.map((it, i) => `
                        <div class="content-item">
                            <span class="content-num">${i + 1}</span>
                            <div>
                                <div class="content-item-title">${it.title}</div>
                                ${it.desc ? `<div class="content-item-desc">${it.desc}</div>` : ""}
                            </div>
                        </div>
                    `).join("")}
                </div>
            ` : `
                <div class="detail-section-title">محتوى المادة</div>
                <div class="content-empty">سيتم إضافة محتوى هذه المادة قريباً.</div>
            `}

            ${prereqs.length ? `
                <div class="detail-section-title">المتطلبات السابقة</div>
                <div>
                    ${prereqs.map(p => `<span class="prereq-tag" onclick="focusNode('${p}')">${p}</span>`).join("")}
                </div>
            ` : ""}

            ${unlocks.length ? `
                <div class="detail-section-title">يؤهلك لدراسة</div>
                <div>
                    ${unlocks.map(u => `<span class="prereq-tag" onclick="focusNode('${u}')">${u}</span>`).join("")}
                </div>
            ` : ""}
        `;

        panel.classList.add("open");
        document.querySelector("svg").classList.add("with-panel");
    }

    function closePanel() {
        const panel = document.getElementById("detail-panel");
        panel.classList.remove("open");
        document.querySelector("svg").classList.remove("with-panel");
    }

    function focusNode(id) {
        const found = data.nodes.find(n => n.id === id);
        if (found) openPanel(found);
    }

    window.closePanel = closePanel;
    window.focusNode = focusNode;

    // سحب العقد
    function dragStart(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }
    function dragDrag(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragEnd(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }
});
