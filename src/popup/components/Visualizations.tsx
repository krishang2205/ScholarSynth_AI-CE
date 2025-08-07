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
  const [loading, setLoading] = useState(true);
  
  const mindMapRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const projectMapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (notes.length > 0 && !loading) {
      renderVisualization();
    }
  }, [notes, projects, tabValue, loading]);

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

    // Clear previous content
    d3.select(mindMapRef.current).selectAll("*").remove();

    // Create mind map data
    const topicCount: { [key: string]: number } = {};
    notes.forEach(note => {
      note.tags.forEach(tag => {
        topicCount[tag] = (topicCount[tag] || 0) + 1;
      });
    });

    const topics = Object.entries(topicCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    if (topics.length === 0) {
      mindMapRef.current.innerHTML = '<div class="empty-state">No topics found</div>';
      return;
    }

    const width = mindMapRef.current.clientWidth;
    const height = 400;

    const svg = d3.select(mindMapRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Create radial layout
    const radius = Math.min(width, height) / 2 - 50;
    const angleStep = (2 * Math.PI) / topics.length;

    // Draw topic nodes
    const topicNodes = g.selectAll('.topic-node')
      .data(topics)
      .enter()
      .append('g')
      .attr('class', 'topic-node')
      .attr('transform', (d, i) => {
        const angle = i * angleStep;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return `translate(${x}, ${y})`;
      });

    // Add circles for topics
    topicNodes.append('circle')
      .attr('r', d => Math.min(20 + d[1] * 3, 50))
      .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
      .attr('opacity', 0.7);

    // Add topic labels
    topicNodes.append('text')
      .text(d => d[0])
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('fill', 'white')
      .attr('font-weight', 'bold');

    // Add topic counts
    topicNodes.append('text')
      .text(d => d[1])
      .attr('text-anchor', 'middle')
      .attr('dy', '1.5em')
      .attr('font-size', '10px')
      .attr('fill', 'white');

    // Draw connections to center
    g.selectAll('.connection')
      .data(topics)
      .enter()
      .append('line')
      .attr('class', 'connection')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', (d, i) => Math.cos(i * angleStep) * radius)
      .attr('y2', (d, i) => Math.sin(i * angleStep) * radius)
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .attr('opacity', 0.5);
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
            <div ref={mindMapRef} style={{ width: '100%', height: 400 }} />
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