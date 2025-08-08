import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  AccountTree as MindMapIcon,
  Timeline as TimelineIcon,
  BubbleChart as ProjectMapIcon
} from '@mui/icons-material';
import { Note, Project, VisualizationData } from '../../types';
import * as d3 from 'd3';

// D3 simulation node interface
interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  noteCount: number;
  size: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`visualization-tabpanel-${index}`}
      aria-labelledby={`visualization-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Visualizations: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  // Mind map settings (phased implementation)
  const [maxTopics, setMaxTopics] = useState(8); // used in later phases
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null); // phase 2 detail panel
  const [showConnections, setShowConnections] = useState(false); // phase 3 inline arcs toggle
  const [showArcModal, setShowArcModal] = useState(false); // phase 3 modal
  const [loading, setLoading] = useState(true);
  
  const mindMapRef = useRef<HTMLDivElement>(null);
  const arcModalRef = useRef<HTMLDivElement>(null); // container for arc modal graph
  // Track which topics are expanded in mind map
  const expandedTopicsRef = useRef<Set<string>>(new Set());
  const timelineRef = useRef<HTMLDivElement>(null);
  const projectMapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (notes.length > 0 && !loading) {
      renderVisualization();
    }
  }, [notes, projects, tabValue, loading, selectedTopic, showConnections]);

  useEffect(()=>{
    if(showArcModal) renderArcModal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[showArcModal, notes, maxTopics]);

  const loadData = async () => {
    try {
      const [notesResponse, projectsResponse] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_NOTES' }),
        chrome.runtime.sendMessage({ type: 'GET_PROJECTS' })
      ]);

      setNotes(notesResponse.notes || []);
      setProjects(projectsResponse.projects || []);
    } catch (error) {
      console.error('Error loading visualization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderVisualization = () => {
    switch (tabValue) {
      case 0:
        renderMindMap();
        break;
      case 1:
        renderTimeline();
        break;
      case 2:
        renderProjectMap();
        break;
    }
  };

  const renderMindMap = () => {
    if (!mindMapRef.current) return;
    const container = mindMapRef.current;
    d3.select(container).selectAll('*').remove();

    // Build tag stats
    const tagCounts: Record<string, number> = {};
    const notesByTag: Record<string, Note[]> = {};
    notes.forEach(note => {
      const uniqueTags = Array.from(new Set(note.tags || []));
      uniqueTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        (notesByTag[tag] = notesByTag[tag] || []).push(note);
      });
    });

  const allTopics = Object.entries(tagCounts).sort((a,b)=> b[1]-a[1]);
  const topics = allTopics.slice(0, maxTopics);
    if (topics.length === 0) {
      container.innerHTML = '<div class="empty-state">No topics found</div>';
      return;
    }

    // Co-occurrence counts among selected topics
    const topicSet = new Set(topics.map(t=>t[0]));
    const pairCount: Record<string, number> = {};
    notes.forEach(note => {
      const relevant = Array.from(new Set(note.tags.filter(t=>topicSet.has(t))));
      for (let i=0;i<relevant.length;i++) {
        for (let j=i+1;j<relevant.length;j++) {
          const key = relevant[i] < relevant[j] ? `${relevant[i]}||${relevant[j]}` : `${relevant[j]}||${relevant[i]}`;
          pairCount[key] = (pairCount[key]||0)+1;
        }
      }
    });
  // pairCount retained for connections / modal

  const width = container.clientWidth;
  const height = 400;
    const cx = width/2;
    const cy = height/2;
    const R = Math.min(width, height)/2 - 70;
    const angleStep = (2*Math.PI)/topics.length;

  const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class','mindmap-svg');

    // Background
    svg.append('rect')
      .attr('x',0).attr('y',0)
      .attr('width',width).attr('height',height)
      .attr('rx',18)
      .attr('fill','#FCF9EE');

    // defs (shadow only needed now)
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id','topicShadow').attr('height','140%');
    filter.append('feDropShadow')
      .attr('dx',0).attr('dy',1).attr('stdDeviation',2).attr('flood-color','#000').attr('flood-opacity',0.2);

    // Central subject label dynamic
  const subjectLabel = 'Top Topics';
    const subjectGroup = svg.append('g').attr('class','subject-group');
    subjectGroup.append('rect')
      .attr('x', cx-70).attr('y', cy-28)
      .attr('width',140).attr('height',56)
      .attr('rx',14)
      .attr('fill','#fff')
      .attr('stroke','#888')
      .attr('stroke-width',1.2)
      .style('filter','url(#topicShadow)')
      .attr('opacity',0.9);
    subjectGroup.append('text')
      .attr('x',cx)
      .attr('y',cy-4)
      .attr('text-anchor','middle')
      .attr('dominant-baseline','middle')
      .attr('font-weight','600')
      .attr('font-size','12px')
      .text(subjectLabel);
    subjectGroup.append('text')
      .attr('x',cx)
      .attr('y',cy+12)
      .attr('text-anchor','middle')
      .attr('font-size','10px')
      .attr('fill','#555')
      .text(`${topics.length} topics / ${notes.length} notes`);

    // Precompute positions
    const topicPos: Record<string,{x:number,y:number}> = {};
    const CARD_H = 40;
    topics.forEach((t, i)=> {
      const angle = i*angleStep - Math.PI/2; // start top
      const x = cx + Math.cos(angle)*R;
      const y = cy + Math.sin(angle)*R;
      topicPos[t[0]] = {x,y};
    });

    // Group layers
    const stemsLayer = svg.append('g');
    stemsLayer.selectAll('line.stem')
      .data(topics)
      .enter()
      .append('line')
      .attr('class','stem')
      .attr('x1',cx).attr('y1',cy)
      .attr('x2', d=> topicPos[d[0]].x)
      .attr('y2', d=> topicPos[d[0]].y)
      .attr('stroke','#e2d7c4')
      .attr('stroke-width',1.1)
      .attr('stroke-dasharray','3 4');

    // Draw co-occurrence arcs above all
    // Inline connection arcs (Phase 3)
    if(showConnections) {
      const edges = Object.entries(pairCount)
        .map(([key,count])=> { const [a,b]=key.split('||'); return {a,b,count}; })
        .filter(e=> e.count>=2)
        .sort((a,b)=> b.count - a.count)
        .slice(0,10);
      const arcLayer = svg.append('g').attr('class','inline-connections');
      arcLayer.selectAll('path.inline-arc')
        .data(edges)
        .enter()
        .append('path')
        .attr('class','inline-arc')
        .attr('d', e=> {
          const p1 = topicPos[e.a]; const p2 = topicPos[e.b]; if(!p1||!p2) return '';
          const mx = (p1.x+p2.x)/2; const my = (p1.y+p2.y)/2 - 40; // lift arc
          return `M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`;
        })
        .attr('fill','none')
        .attr('stroke','#c95151')
        .attr('stroke-width', e=> 0.6 + e.count)
        .attr('opacity',0.25)
        .on('mouseover', function(){ d3.select(this).attr('opacity',0.7); })
        .on('mouseout', function(){ d3.select(this).attr('opacity',0.25); });
    }

    // Topic groups
  const topicGroup = svg.append('g').attr('class','topics-layer').selectAll('g.topic')
      .data(topics, (d:any)=> d[0])
      .enter()
      .append('g')
      .attr('class','topic')
      .attr('transform', d=> `translate(${topicPos[d[0]].x},${topicPos[d[0]].y})`)
      .style('cursor','pointer');

    // Card background
    topicGroup.append('rect')
      .attr('x', -55)
      .attr('y', -CARD_H/2)
      .attr('width', 110)
      .attr('height', CARD_H)
      .attr('rx', 8)
      .attr('fill', (d,i)=> d3.schemeCategory10[i%10])
      .attr('stroke','#333')
      .attr('stroke-width',0.6)
      .style('filter','url(#topicShadow)')
      .attr('opacity',0.85);

    topicGroup.append('text')
      .attr('text-anchor','middle')
      .attr('y', -4)
      .attr('fill','#fff')
      .attr('font-size','12px')
      .attr('font-weight','600')
      .text(d=> d[0]);
    topicGroup.append('text')
      .attr('text-anchor','middle')
      .attr('y', 12)
      .attr('fill','#fff')
      .attr('font-size','10px')
      .text(d=> `${d[1]} notes`);

    // Topic click -> toggle selection (Phase 2)
    topicGroup.on('click', (event, d:any)=> {
      const tag = d[0];
      setSelectedTopic(prev => prev === tag ? null : tag);
    });

    // Detail panel (Phase 2)
    if(selectedTopic && topicPos[selectedTopic]) {
      const p = topicPos[selectedTopic];
      const relatedNotes = (notesByTag[selectedTopic]||[]).slice(0,5);
      const secondaryCounts: Record<string,number> = {};
      relatedNotes.forEach(n => n.tags.forEach(t => { if(t!==selectedTopic) secondaryCounts[t]=(secondaryCounts[t]||0)+1; }));
      const topSecondary = Object.entries(secondaryCounts).sort((a,b)=> b[1]-a[1]).slice(0,6).map(x=>x[0]);
      const panelW = 190; const panelH = 170;
      const fx = p.x + (p.x < cx ? 18 : -panelW-18); // position left/right
      const fy = Math.min(Math.max(p.y - panelH/2, 8), height-panelH-8);
      const foreign = svg.append('foreignObject')
        .attr('x', fx)
        .attr('y', fy)
        .attr('width', panelW)
        .attr('height', panelH)
        .style('overflow','visible');
      const div = foreign.append('xhtml:div')
        .style('background','#ffffff')
        .style('border','1px solid #e1dbcf')
        .style('box-shadow','0 6px 14px rgba(0,0,0,0.16)')
        .style('border-radius','14px')
        .style('font-size','11px')
        .style('padding','10px 10px 6px')
        .style('width', panelW+'px')
        .style('height', panelH+'px')
        .style('display','flex')
        .style('flexDirection','column')
        .style('gap','6px');
      const hdr = div.append('div')
        .style('display','flex')
        .style('alignItems','center')
        .style('justifyContent','space-between');
      hdr.append('span')
        .style('font-weight','600')
        .style('font-size','12px')
        .style('color','#2d2a25')
        .text(selectedTopic + ` (${relatedNotes.length})`);
      hdr.append('button')
        .text('×')
        .style('background','transparent')
        .style('border','none')
        .style('font-size','14px')
        .style('line-height','14px')
        .style('cursor','pointer')
        .style('color','#444')
        .on('click', ()=> setSelectedTopic(null));
      const list = div.append('div')
        .style('flex','1')
        .style('overflow','auto')
        .style('border-top','1px solid #f0ece3')
        .style('padding','4px 0 0');
      relatedNotes.forEach(n => {
        const item = list.append('div')
          .style('padding','2px 0')
          .style('cursor', n.url? 'pointer':'default')
          .style('border-bottom','1px dashed #eee')
          .text(n.title.length>55? n.title.substring(0,54)+'…': n.title)
          .on('click', ()=> { if(n.url) chrome.tabs.create({url: n.url}); });
      });
      if(topSecondary.length) {
        const kw = div.append('div')
          .style('border-top','1px solid #f0ece3')
          .style('padding','4px 0 0');
        kw.append('div')
          .style('font-weight','600')
          .style('marginBottom','2px')
          .style('font-size','11px')
          .text('Keywords');
        const tagWrap = kw.append('div')
          .style('display','flex')
          .style('flexWrap','wrap')
          .style('gap','4px');
        tagWrap.selectAll('span')
          .data(topSecondary)
          .enter()
          .append('span')
          .style('background','#f4efe7')
          .style('border','1px solid #e1dbcf')
          .style('border-radius','10px')
          .style('padding','2px 6px')
          .style('font-size','10px')
          .style('color','#555')
          .text(d=> d.length>18? d.substring(0,17)+'…': d);
      }
    }
  // end renderMindMap modifications phase 3
  };

  // Phase 3: Arc modal rendering
  const renderArcModal = () => {
    if(!arcModalRef.current) return;
    const container = arcModalRef.current;
    d3.select(container).selectAll('*').remove();
    // build tag stats again
    const tagCounts: Record<string, number> = {};
    const notesByTag: Record<string, Note[]> = {};
    notes.forEach(note => {
      const uniqueTags = Array.from(new Set(note.tags || []));
      uniqueTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        (notesByTag[tag] = notesByTag[tag] || []).push(note);
      });
    });
    const topics = Object.entries(tagCounts).sort((a,b)=> b[1]-a[1]).slice(0,maxTopics);
    if(!topics.length) { container.innerHTML = '<div style="padding:12px;font-size:12px;">No topics</div>'; return; }
    const topicSet = new Set(topics.map(t=>t[0]));
    const pairCount: Record<string, number> = {};
    notes.forEach(note => {
      const rel = Array.from(new Set(note.tags.filter(t=>topicSet.has(t))));
      for(let i=0;i<rel.length;i++) for(let j=i+1;j<rel.length;j++) {
        const key = rel[i] < rel[j] ? `${rel[i]}||${rel[j]}` : `${rel[j]}||${rel[i]}`;
        pairCount[key] = (pairCount[key]||0)+1;
      }
    });
    const edges = Object.entries(pairCount)
      .map(([key,count])=> { const [a,b]=key.split('||'); return {a,b,count}; })
      .filter(e=> e.count>=1)
      .sort((a,b)=> b.count - a.count)
      .slice(0,40);
    const width = container.clientWidth;
    const height = container.clientHeight;
    const cx = width/2; const cy = height/2; const R = Math.min(width,height)/2 - 70;
    const angleStep = (2*Math.PI)/topics.length;
    const topicPos: Record<string,{x:number,y:number,angle:number}> = {};
    topics.forEach((t,i)=> {
      const angle = i*angleStep - Math.PI/2;
      topicPos[t[0]] = {x: cx + Math.cos(angle)*R, y: cy + Math.sin(angle)*R, angle};
    });
    const svg = d3.select(container)
      .append('svg')
      .attr('width',width)
      .attr('height',height);
    svg.append('rect').attr('width',width).attr('height',height).attr('rx',14).attr('fill','#FBF8F0');
    // edges as inner arcs
    const edgeGroup = svg.append('g').attr('class','modal-edges');
    const maxCount = edges.length? d3.max(edges, e=> e.count)||1 : 1;
    const scaleWidth = d3.scaleLinear().domain([1,maxCount]).range([0.6,4]);
    edgeGroup.selectAll('path.edge')
      .data(edges)
      .enter()
      .append('path')
      .attr('class','edge')
      .attr('d', e=> {
        const a = topicPos[e.a]; const b = topicPos[e.b]; if(!a||!b) return '';
        // draw curved inside path using midpoint outward
        const mx = (a.x+b.x)/2; const my = (a.y+b.y)/2; const dx = cx - mx; const dy = cy - my;
        const lift = 0.55;
        const qx = mx + dx*lift; const qy = my + dy*lift;
        return `M${a.x},${a.y} Q${qx},${qy} ${b.x},${b.y}`;
      })
      .attr('fill','none')
      .attr('stroke','#b64646')
      .attr('stroke-width', e=> scaleWidth(e.count))
      .attr('opacity',0.22)
      .on('mouseover', function(){ d3.select(this).attr('opacity',0.75); })
      .on('mouseout', function(){ d3.select(this).attr('opacity',0.22); });
    // topic nodes
    const nodeGroup = svg.append('g').attr('class','modal-topics');
    const g = nodeGroup.selectAll('g.topic')
      .data(topics)
      .enter()
      .append('g')
      .attr('class','topic')
      .attr('transform', d=> `translate(${topicPos[d[0]].x},${topicPos[d[0]].y})`);
    g.append('circle')
      .attr('r', 26)
      .attr('fill',(d,i)=> d3.schemeCategory10[i%10])
      .attr('stroke','#333')
      .attr('stroke-width',0.8)
      .attr('opacity',0.9);
    g.append('text')
      .attr('text-anchor','middle')
      .attr('y',-4)
      .attr('fill','#fff')
      .attr('font-size','11px')
      .attr('font-weight','600')
      .text(d=> d[0].length>10? d[0].substring(0,9)+'…': d[0]);
    g.append('text')
      .attr('text-anchor','middle')
      .attr('y',10)
      .attr('fill','#fff')
      .attr('font-size','9px')
      .text(d=> d[1]+ ' notes');
    // legend small
    svg.append('text')
      .attr('x',cx)
      .attr('y',30)
      .attr('text-anchor','middle')
      .attr('font-size','12px')
      .attr('font-weight','600')
      .text('Topic Connections');
  };

  const renderTimeline = () => {
    if (!timelineRef.current) return;

    // Clear previous content
    d3.select(timelineRef.current).selectAll("*").remove();

    if (notes.length === 0) {
      timelineRef.current.innerHTML = '<div class="empty-state">No notes found</div>';
      return;
    }

    const width = timelineRef.current.clientWidth;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };

    const svg = d3.select(timelineRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Parse dates
    const dateData = notes.map(note => ({
      date: new Date(note.createdAt),
      title: note.title,
      tags: note.tags
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    const xScale = d3.scaleTime()
      .domain(d3.extent(dateData, d => d.date) as [Date, Date])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(dateData, (d, i) => i) || 0])
      .range([height - margin.bottom, margin.top]);

    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale));

    // Add Y axis
    svg.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale));

    // Add data points
    svg.selectAll('.data-point')
      .data(dateData)
      .enter()
      .append('circle')
      .attr('class', 'data-point')
      .attr('cx', d => xScale(d.date))
      .attr('cy', (d, i) => yScale(i))
      .attr('r', 4)
      .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
      .attr('opacity', 0.7)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 6);
        
        // Add tooltip
        const tooltip = svg.append('g')
          .attr('class', 'tooltip')
          .attr('transform', `translate(${xScale(d.date) + 10}, ${yScale(dateData.indexOf(d)) - 10})`);
        
        tooltip.append('rect')
          .attr('width', 200)
          .attr('height', 60)
          .attr('fill', 'white')
          .attr('stroke', '#ccc')
          .attr('rx', 4);
        
        tooltip.append('text')
          .attr('x', 5)
          .attr('y', 15)
          .attr('font-size', '12px')
          .text(d.title.substring(0, 30) + (d.title.length > 30 ? '...' : ''));
        
        tooltip.append('text')
          .attr('x', 5)
          .attr('y', 30)
          .attr('font-size', '10px')
          .attr('fill', '#666')
          .text(d.date.toLocaleDateString());
        
        tooltip.append('text')
          .attr('x', 5)
          .attr('y', 45)
          .attr('font-size', '10px')
          .attr('fill', '#666')
          .text(d.tags.slice(0, 2).join(', '));
      })
      .on('mouseout', function() {
        d3.select(this).attr('r', 4);
        svg.selectAll('.tooltip').remove();
      });

    // Add line connecting points
    const line = d3.line<{date: Date, title: string, tags: string[]}>()
      .x(d => xScale(d.date))
      .y((d, i) => yScale(i));

    svg.append('path')
      .datum(dateData)
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .attr('d', line);
  };

  const renderProjectMap = () => {
    if (!projectMapRef.current) return;

    // Clear previous content
    d3.select(projectMapRef.current).selectAll("*").remove();

    if (projects.length === 0) {
      projectMapRef.current.innerHTML = '<div class="empty-state">No projects found</div>';
      return;
    }

    const width = projectMapRef.current.clientWidth;
    const height = 400;

    const svg = d3.select(projectMapRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Group notes by project
    const projectData: D3Node[] = projects.map(project => {
      const projectNotes = notes.filter(note => note.project === project.id);
      return {
        ...project,
        noteCount: projectNotes.length,
        size: Math.max(20, projectNotes.length * 10)
      };
    }).filter(project => project.noteCount > 0);

    if (projectData.length === 0) {
      projectMapRef.current.innerHTML = '<div class="empty-state">No projects with notes found</div>';
      return;
    }

    // Create force simulation
    const simulation = d3.forceSimulation<D3Node>(projectData)
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3Node>().radius(d => d.size + 5));

    // Add project nodes
    const nodes = svg.selectAll('.project-node')
      .data(projectData)
      .enter()
      .append('g')
      .attr('class', 'project-node');

    nodes.append('circle')
      .attr('r', d => d.size)
      .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
      .attr('opacity', 0.7);

    nodes.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('fill', 'white')
      .attr('font-weight', 'bold');

    nodes.append('text')
      .text(d => `${d.noteCount} notes`)
      .attr('text-anchor', 'middle')
      .attr('dy', '1.5em')
      .attr('font-size', '10px')
      .attr('fill', 'white');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      nodes.attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
    });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box className="loading">
        <div className="loading-spinner"></div>
        <Typography>Loading visualizations...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Visualizations
      </Typography>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab 
              icon={<MindMapIcon />} 
              label="Mind Map" 
              iconPosition="start"
            />
            <Tab 
              icon={<TimelineIcon />} 
              label="Timeline" 
              iconPosition="start"
            />
            <Tab 
              icon={<ProjectMapIcon />} 
              label="Project Map" 
              iconPosition="start"
            />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Topic Mind Map
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Visual representation of your research topics and their connections
            </Typography>
            {/* Phase 3 controls: max topics + connections toggle + modal button */}
            <Box sx={{ display:'flex', gap:2, mb:1.5, flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <label htmlFor="max-topics" style={{ fontSize:12 }}>Max topics:</label>
                <select
                  id="max-topics"
                  value={maxTopics}
                  onChange={e=> setMaxTopics(parseInt(e.target.value)||8)}
                  style={{ fontSize:12, padding:'2px 4px', borderRadius:6 }}
                >
                  {[4,6,8,10,12].map(n=> <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <input id="toggle-inline" type="checkbox" checked={showConnections} onChange={e=> setShowConnections(e.target.checked)} style={{ cursor:'pointer' }} />
                <label htmlFor="toggle-inline" style={{ fontSize:12, cursor:'pointer' }}>Inline connections</label>
              </div>
              <button
                onClick={()=> setShowArcModal(true)}
                style={{ fontSize:12, padding:'4px 10px', borderRadius:18, border:'1px solid #b99d7a', background:'#fff8ef', cursor:'pointer' }}
              >Open Connection Map</button>
            </Box>
            <Box sx={{ position:'relative' }}>
              <div ref={mindMapRef} style={{ width: '100%', height: 400 }} />
              {showArcModal && (
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>
                  <div style={{ background:'#fff', width:'560px', maxWidth:'100%', height:'440px', borderRadius:18, padding:'14px 16px', boxShadow:'0 8px 24px rgba(0,0,0,0.25)', position:'relative', display:'flex', flexDirection:'column' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:14, fontWeight:600 }}>Topic Connection Map</span>
                      <button onClick={()=> setShowArcModal(false)} style={{ border:'none', background:'transparent', fontSize:18, lineHeight:'18px', cursor:'pointer' }}>×</button>
                    </div>
                    <div ref={arcModalRef} style={{ flex:1, width:'100%' }} />
                    <div style={{ textAlign:'right', marginTop:6 }}>
                      <button onClick={()=> setShowArcModal(false)} style={{ fontSize:12, padding:'4px 12px', borderRadius:16, border:'1px solid #999', background:'#fafafa', cursor:'pointer' }}>Close</button>
                    </div>
                  </div>
                </div>
              )}
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Research Timeline
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Timeline of your research notes and discoveries
            </Typography>
            <div ref={timelineRef} style={{ width: '100%', height: 300 }} />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Project Clusters
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Interactive visualization of your research projects and their note counts
            </Typography>
            <div ref={projectMapRef} style={{ width: '100%', height: 400 }} />
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Visualizations; 