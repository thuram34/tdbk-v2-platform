import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  Layout,
  Layers,
  Activity,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Copy,
  ChevronRight,
  Database,
  ArrowRight,
  Calculator,
  Image,
  RefreshCw,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { tdbkContextEngine, TdbkContext } from '../../platform/contextEngine';
import { tdbkKnowledgeResource, TdbkResource } from '../../platform/knowledgeResource';
import { tdbkSemanticExpression, SemanticExpression } from '../../platform/semanticExpressionEngine';
import { tdbkInteractiveRuntime, CanvasObject } from '../../platform/interactiveExperienceRuntime';
import { tdbkVisualCreation } from '../../platform/visualCreation';
import { tdbkSessionRuntime, TdbkSession } from '../../platform/sessionRuntime';
import { tdbkProactiveIntelligence, IntelligenceRecommendation } from '../../platform/proactiveIntelligence';
import { educationDomain, CbcStrand } from '../../education/educationDomain';

interface SmartClassroomViewProps {
  tenantId: string;
  userId: string;
  userName: string;
}

export const SmartClassroomView: React.FC<SmartClassroomViewProps> = ({
  tenantId,
  userId,
  userName,
}) => {
  // Topics available in Grade 5 Education Domain
  const topics = [
    { id: 'fractions', label: 'Grade 5 Mathematics - Fractions', area: 'math_g5', strand: 'fractions_g5', subStrand: 'Fractions' },
    { id: 'odd_even', label: 'Grade 5 Mathematics - Odd & Even Numbers', area: 'math_g5', strand: 'numbers_g5', subStrand: 'Odd & Even' },
    { id: 'photosynthesis', label: 'Grade 5 Science - Photosynthesis', area: 'science_g5', strand: 'plants_g5', subStrand: 'Photosynthesis' },
  ];

  const [selectedTopic, setSelectedTopic] = useState(topics[0]);
  const [session, setSession] = useState<TdbkSession | null>(null);
  const [recommendations, setRecommendations] = useState<IntelligenceRecommendation[]>([]);
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>([]);
  const [activeExperience, setActiveExperience] = useState<'BUILD' | 'PROCESS' | 'SORT'>('BUILD');
  
  // Custom interactive fraction segment states
  const [fractionSlices, setFractionSlices] = useState<number>(4);
  const [selectedSlices, setSelectedSlices] = useState<Set<number>>(new Set([0]));

  // Semantic lab states
  const [rawFormulaInput, setRawFormulaInput] = useState<string>('1/2 + 1/4 = 3/4');
  const [parsedExpression, setParsedExpression] = useState<SemanticExpression | null>(null);

  // Visual Generator states
  const [visualPrompt, setVisualPrompt] = useState<string>('Draw circular equivalent fractions diagram');
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);

  // Sorting results
  const [sortStatus, setSortStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Active curriculum guides
  const [strandGuide, setStrandGuide] = useState<CbcStrand | null>(null);

  // Setup/Initialize session and load proactive recommendations
  const initTopicSession = (topic: typeof topics[0]) => {
    // 1. Setup platform context
    const initialContext: TdbkContext = {
      who: {
        personId: userId,
        identityId: 'inst_school_01',
        activeRole: 'TEACHER',
        organizationMembershipId: 'member_01',
        name: userName,
      },
      where: {
        tenantId,
        branchId: 'hq_branch',
        workspaceId: 'workspace_school_academics',
        environment: 'production',
        surfaceType: 'WEB_WORKSPACE',
      },
      what: {
        domainMetadata: {
          grade: 'Grade 5',
          learningArea: topic.area === 'math_g5' ? 'Mathematics' : 'Science',
          strand: topic.strand === 'fractions_g5' ? 'Fractions' : 'Plants',
          subStrand: topic.subStrand,
        },
      },
      why: {
        intent: 'TEACH',
        businessObjective: 'Deliver digitized CBC curriculum experience',
      },
      when: {
        timestamp: new Date().toISOString(),
        sessionId: '',
      },
      state: {
        currentState: 'TEACHING_WORKSPACE_ACTIVE',
        availableCapabilities: ['smart_classroom', 'cbc_grading'],
        permissions: ['read:curriculum', 'write:interactive_canvas'],
      },
    };

    const context = tdbkContextEngine.initializeContext(initialContext);

    // 2. Fetch Curriculum Guides
    const guide = educationDomain.getStrand(topic.area, topic.strand);
    if (guide) {
      setStrandGuide(guide);
    }

    // 3. Proactive Intelligence analysis
    const proposals = tdbkProactiveIntelligence.analyzeAndPropose(context);
    setRecommendations(proposals);

    // 4. Load recommended experience components
    const recExperience = proposals.find(p => p.type === 'EXPERIENCE');
    if (recExperience && recExperience.payload.experienceType) {
      const expType = recExperience.payload.experienceType as 'BUILD' | 'PROCESS' | 'SORT';
      setActiveExperience(expType);
      
      const objs = recExperience.payload.suggestedObjects || [];
      tdbkInteractiveRuntime.setObjects(objs);
      setCanvasObjects(objs);

      // Create TDBK platform-native session
      const newSess = tdbkSessionRuntime.createSession(tenantId, 'hq_branch', userId, context, objs);
      setSession(newSess);
    }

    // Reset local states
    setSortStatus(null);
    setRenderedSvg(null);

    // Preseed Semantic Lab Inputs based on topic
    if (topic.id === 'fractions') {
      setRawFormulaInput('1/2 + 1/4 = 3/4');
    } else if (topic.id === 'photosynthesis') {
      setRawFormulaInput('H2O + CO2 -> Sugar + O2');
    } else if (topic.id === 'odd_even') {
      setRawFormulaInput('7 < 12');
    }
  };

  // Init on mount or topic change
  useEffect(() => {
    initTopicSession(selectedTopic);
  }, [selectedTopic]);

  // Recalculate expression lab parsing
  useEffect(() => {
    if (rawFormulaInput) {
      const parsed = tdbkSemanticExpression.parse(rawFormulaInput);
      setParsedExpression(parsed);
    }
  }, [rawFormulaInput]);

  // Handle manual coordinate manipulation of canvas items
  const handleMoveObject = (id: string, dx: number, dy: number) => {
    const obj = canvasObjects.find(o => o.id === id);
    if (obj) {
      tdbkInteractiveRuntime.updateObject(id, { x: obj.x + dx, y: obj.y + dy });
      setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
      logToHistory(`Moved ${obj.label}`);
    }
  };

  const handleToggleLock = (id: string) => {
    const obj = canvasObjects.find(o => o.id === id);
    if (obj) {
      tdbkInteractiveRuntime.updateObject(id, { isLocked: !obj.isLocked });
      setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
      logToHistory(`${obj.label} ${!obj.isLocked ? 'Locked' : 'Unlocked'}`);
    }
  };

  const handleDeleteObject = (id: string) => {
    tdbkInteractiveRuntime.deleteObject(id);
    setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
    logToHistory(`Deleted object ID: ${id}`);
  };

  const handleDuplicateObject = (id: string) => {
    tdbkInteractiveRuntime.duplicateObject(id);
    setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
    logToHistory(`Duplicated object ID: ${id}`);
  };

  const logToHistory = (message: string) => {
    if (session) {
      const updatedSess = tdbkSessionRuntime.saveSession(session.sessionId, tdbkInteractiveRuntime.getObjects(), {
        lastEvent: message
      });
      setSession(updatedSess);
    }
  };

  // BUILD interaction: fraction slicer toggle
  const toggleSegment = (index: number) => {
    const next = new Set(selectedSlices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedSlices(next);

    // Update pizza segment in interactive runtime
    const val = next.size / fractionSlices;
    const pizzaObj = canvasObjects.find(o => o.id === 'pizza_main');
    if (pizzaObj) {
      tdbkInteractiveRuntime.updateObject('pizza_main', {
        label: `${next.size}/${fractionSlices} Segment`,
        behaviour: { ...pizzaObj.behaviour, value: val },
        state: { ...pizzaObj.state, activeSlices: next.size, slices: fractionSlices }
      });
      setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
      logToHistory(`Segment slice toggled: ${next.size}/${fractionSlices}`);
    }
  };

  const handleSliceCountChange = (count: number) => {
    setFractionSlices(count);
    setSelectedSlices(new Set([0]));
    const val = 1 / count;
    const pizzaObj = canvasObjects.find(o => o.id === 'pizza_main');
    if (pizzaObj) {
      tdbkInteractiveRuntime.updateObject('pizza_main', {
        label: `1/${count} Segment`,
        behaviour: { ...pizzaObj.behaviour, value: val },
        state: { ...pizzaObj.state, activeSlices: 1, slices: count }
      });
      setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
      logToHistory(`Slices division set to ${count}`);
    }
  };

  // SORT interaction: classify item
  const handleClassifyCard = (cardId: string, bucketId: string) => {
    const card = canvasObjects.find(o => o.id === cardId);
    const bucket = canvasObjects.find(o => o.id === bucketId);
    
    if (!card || !bucket) return;

    const cardVal = card.behaviour.value as number;
    const bucketType = bucket.behaviour.value as 'ODD' | 'EVEN';

    const isCorrect = (cardVal % 2 !== 0 && bucketType === 'ODD') || (cardVal % 2 === 0 && bucketType === 'EVEN');

    if (isCorrect) {
      setSortStatus({ success: true, message: `Excellent! Card ${cardVal} belongs inside the ${bucketType} Numbers Bin!` });
      // Remove from canvas, or show in bucket state
      const existingIn = (bucket.state.itemsIn || []) as number[];
      if (!existingIn.includes(cardVal)) {
        tdbkInteractiveRuntime.updateObject(bucketId, {
          state: { ...bucket.state, itemsIn: [...existingIn, cardVal] }
        });
        tdbkInteractiveRuntime.deleteObject(cardId);
      }
      setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
      logToHistory(`Correct sorting: ${cardVal} inside ${bucketType}`);
    } else {
      setSortStatus({ success: false, message: `Hold on! ${cardVal} is not divisible into the ${bucketType} Numbers Bin. Try again!` });
      logToHistory(`Incorrect sorting attempt: ${cardVal} into ${bucketType}`);
    }
  };

  // PROCESS interaction: Chlorophyll Reaction excitation
  const triggerExcitationSimulation = () => {
    // Collect leaf inputs from runtime
    const hasLight = canvasObjects.some(o => o.id === 'node_sunlight');
    const hasH2O = canvasObjects.some(o => o.id === 'node_h2o');
    const hasCO2 = canvasObjects.some(o => o.id === 'node_co2');
    const chlorophyll = canvasObjects.find(o => o.id === 'node_chlorophyll');

    if (hasLight && hasH2O && hasCO2 && chlorophyll) {
      tdbkInteractiveRuntime.updateObject('node_chlorophyll', {
        label: '🍃 ACTIVE Chlorophyll Cycle (Photosynthesis)',
        state: { satisfied: true },
        visualProperties: { ...chlorophyll.visualProperties, backgroundColor: '#22c55e', borderColor: '#15803d' }
      });
      setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
      setSortStatus({ success: true, message: '🎉 Light, CO2, and H2O reacted inside Chloroplast! Plants synthesized Sugar and released Oxygen (O2)!' });
      logToHistory('Photosynthesis simulation cycle successfully excited.');
    } else {
      setSortStatus({ success: false, message: 'Photosynthesis failed! Make sure Sunlight, Water, and Carbon Dioxide exist on your teaching board!' });
    }
  };

  // Generate customized SVG assets
  const handleTriggerVisualCreation = () => {
    const result = tdbkVisualCreation.resolveVisual(tenantId, visualPrompt, {
      grade: 'Grade 5',
      strand: selectedTopic.subStrand,
    });

    if (result.svgMarkup) {
      setRenderedSvg(result.svgMarkup);
      // Place as a new custom canvas node object
      const assetObj: CanvasObject = {
        id: result.assetId,
        type: 'DIAGRAM_NODE',
        label: result.title,
        x: 180,
        y: 120,
        width: 180,
        height: 100,
        rotation: 0,
        zIndex: 5,
        isLocked: false,
        visualProperties: { backgroundColor: '#1e293b', color: '#818cf8', borderRadius: '8px' },
        semanticMeaning: result.description,
        relationships: [],
        behaviour: { isDraggable: true, isResizable: true },
        state: { isSvgHolder: true, markup: result.svgMarkup }
      };
      tdbkInteractiveRuntime.addObject(assetObj);
      setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
      logToHistory(`Generated & loaded visual: ${result.title}`);
    }
  };

  // Undo implementation
  const handleUndo = () => {
    const undon = tdbkInteractiveRuntime.undo();
    if (undon) {
      setCanvasObjects([...tdbkInteractiveRuntime.getObjects()]);
      logToHistory('Undo canvas step executed.');
    }
  };

  return (
    <div id="smart-classroom-view" className="w-full min-h-screen bg-[#f8fafc] text-[#334155] font-sans flex flex-col antialiased">
      {/* 1. Header Toolbar */}
      <header id="classroom-header" className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#1e293b] flex items-center gap-2">
              Smart Classroom Interactive Runtime
              <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                PLATFORM-NATIVE V2
              </span>
            </h1>
            <p className="text-xs text-[#64748b]">
              Universal Experience Engine • Active Teacher: <span className="font-semibold">{userName}</span>
            </p>
          </div>
        </div>

        {/* Dynamic Topic Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-[#64748b] hidden lg:block">Active Curriculum Segment:</label>
          <div className="relative">
            <select
              id="topic-selector"
              value={selectedTopic.id}
              onChange={(e) => {
                const found = topics.find(t => t.id === e.target.value);
                if (found) setSelectedTopic(found);
              }}
              className="appearance-none bg-white border border-[#cbd5e1] text-sm text-[#1e293b] rounded-lg px-4 pr-10 py-2 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer hover:bg-slate-50 transition-colors"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#64748b]">
              <ChevronRight className="w-4 h-4 rotate-90" />
            </div>
          </div>

          <button
            onClick={() => initTopicSession(selectedTopic)}
            title="Reset active segment"
            className="p-2 text-[#64748b] hover:text-[#1e293b] hover:bg-slate-100 rounded-lg border border-[#e2e8f0] bg-white transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Work Layout (3-Column Bento Dashboard) */}
      <main id="classroom-main" className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: CBC Teacher's Lesson Dashboard (Syllabus Mapped) */}
        <div id="cbc-syllabus-column" className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 mb-3">
              <BookOpen className="w-4 h-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700">CBC Syllabus Blueprint</h2>
            </div>
            
            {strandGuide ? (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#1e293b]">{selectedTopic.label}</h3>
                  <span className="inline-block mt-1 text-[10px] bg-slate-100 text-[#475569] font-semibold px-2 py-0.5 rounded">
                    Grade 5 Strand: {strandGuide.name}
                  </span>
                </div>

                <div className="border-t border-[#f1f5f9] pt-3">
                  <h4 className="text-xs font-bold text-[#475569] mb-1">Learning Objectives:</h4>
                  <ul className="text-xs text-[#64748b] space-y-1 list-disc list-inside">
                    {strandGuide.learningObjectives.map((o, idx) => (
                      <li key={idx} className="leading-relaxed">{o}</li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-[#f1f5f9] pt-3">
                  <h4 className="text-xs font-bold text-[#475569] mb-1">Pedagogical Strategies:</h4>
                  <ul className="text-xs text-[#64748b] space-y-1 list-disc list-inside">
                    {strandGuide.pedagogicalStrategies.map((s, idx) => (
                      <li key={idx} className="leading-relaxed">{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-[#f1f5f9] pt-3">
                  <h4 className="text-xs font-bold text-[#475569] mb-1">Assessment Criteria:</h4>
                  <ul className="text-xs text-[#64748b] space-y-1 list-disc list-inside">
                    {strandGuide.assessmentCriteria.map((c, idx) => (
                      <li key={idx} className="leading-relaxed">{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Loading curriculum mapping...</p>
            )}
          </div>

          {/* Proactive TDBK Intelligence Recommendations */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700">TDBK Proactive AI</h2>
            </div>

            <div className="space-y-3">
              {recommendations.map((rec) => (
                <div key={rec.id} className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100/80 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-indigo-900">{rec.title}</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-mono font-bold">
                      {Math.round(rec.confidence * 100)}% match
                    </span>
                  </div>
                  <p className="text-[#475569] leading-relaxed mb-2">{rec.description}</p>
                  
                  {rec.payload.suggestedActions && (
                    <div className="mt-2 pt-2 border-t border-indigo-100/50">
                      <span className="font-bold text-indigo-950 block mb-1">Suggested Proactive Steps:</span>
                      <ul className="space-y-1 text-[#475569]">
                        {rec.payload.suggestedActions.map((act, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-indigo-500">•</span>
                            <span>{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column: Universal Interactive Teaching Surface */}
        <div id="teaching-surface-column" className="lg:col-span-6 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm flex flex-col overflow-hidden">
            {/* Board Header Actions */}
            <div className="bg-slate-50 border-b border-[#e2e8f0] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layout className="w-4 h-4 text-[#475569]" />
                <span className="text-xs font-bold text-[#475569]">Universal Interactive Surface</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleUndo}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 border border-[#cbd5e1] rounded font-medium transition-colors cursor-pointer active:scale-95"
                >
                  Undo Action
                </button>
              </div>
            </div>

            {/* Interactive Stage Canvas Container */}
            <div
              id="teaching-surface-canvas"
              className="relative w-full h-[380px] bg-slate-900 overflow-hidden select-none border-b border-[#e2e8f0]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-60"></div>

              {/* RENDER DYNAMIC CANVAS OBJECTS */}
              <AnimatePresence>
                {canvasObjects.map((obj) => (
                  <motion.div
                    key={obj.id}
                    layoutId={obj.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    style={{
                      position: 'absolute',
                      left: obj.x,
                      top: obj.y,
                      width: obj.width,
                      height: obj.height,
                      zIndex: obj.zIndex,
                    }}
                    className={`rounded-lg p-3 flex flex-col justify-between border shadow-lg cursor-grab active:cursor-grabbing select-none ${
                      obj.isLocked ? 'border-amber-500 bg-slate-800' : 'border-slate-700 bg-slate-800/90'
                    }`}
                  >
                    {/* Header Controls */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-1.5 mb-1.5 text-[10px]">
                      <span className="font-mono font-semibold text-slate-400 uppercase truncate max-w-[80px]">
                        {obj.type}
                      </span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleLock(obj.id)}
                          title={obj.isLocked ? 'Unlock Object' : 'Lock Object'}
                          className="p-0.5 text-slate-400 hover:text-white rounded"
                        >
                          {obj.isLocked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                        </button>
                        {!obj.isLocked && (
                          <>
                            <button
                              onClick={() => handleDuplicateObject(obj.id)}
                              title="Duplicate"
                              className="p-0.5 text-slate-400 hover:text-white rounded"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteObject(obj.id)}
                              title="Delete"
                              className="p-0.5 text-slate-400 hover:text-rose-400 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Object Content Body */}
                    <div className="flex-1 flex flex-col justify-center items-center text-center px-1">
                      {obj.type === 'PIZZA_SLICE' ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="text-xs font-bold text-rose-300">{obj.label}</span>
                          {/* Segment preview circle */}
                          <div className="w-16 h-16 rounded-full border border-slate-600 relative overflow-hidden bg-slate-950 flex items-center justify-center">
                            <span className="text-xs font-bold text-white font-mono">{obj.state?.activeSlices}/{obj.state?.slices}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-white leading-snug">{obj.label}</span>
                      )}

                      {obj.semanticMeaning && (
                        <p className="text-[9px] text-slate-400 mt-1.5 line-clamp-2 italic leading-relaxed">
                          {obj.semanticMeaning}
                        </p>
                      )}
                    </div>

                    {/* Quick Move D-Pad for Precise Control in Browser Iframe */}
                    <div className="mt-2 pt-1 border-t border-slate-700/40 flex justify-between items-center text-[9px] text-slate-500">
                      <span>Coordinates: {obj.x}, {obj.y}</span>
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleMoveObject(obj.id, -20, 0)} className="px-1 bg-slate-950 text-slate-300 hover:bg-slate-700 rounded font-mono font-bold">&larr;</button>
                        <button onClick={() => handleMoveObject(obj.id, 0, -20)} className="px-1 bg-slate-950 text-slate-300 hover:bg-slate-700 rounded font-mono font-bold">&uarr;</button>
                        <button onClick={() => handleMoveObject(obj.id, 0, 20)} className="px-1 bg-slate-950 text-slate-300 hover:bg-slate-700 rounded font-mono font-bold">&darr;</button>
                        <button onClick={() => handleMoveObject(obj.id, 20, 0)} className="px-1 bg-slate-950 text-slate-300 hover:bg-slate-700 rounded font-mono font-bold">&rarr;</button>
                      </div>
                    </div>

                    {/* Odd/Even Bucket Target Assignment Drawer */}
                    {activeExperience === 'SORT' && obj.type === 'NUMBER_CARD' && (
                      <div className="mt-2 flex gap-1 justify-center z-10" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleClassifyCard(obj.id, 'bucket_odd')}
                          className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[9px]"
                        >
                          Send Odd
                        </button>
                        <button
                          onClick={() => handleClassifyCard(obj.id, 'bucket_even')}
                          className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[9px]"
                        >
                          Send Even
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* No items in canvas warning */}
              {canvasObjects.length === 0 && (
                <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6 text-slate-400">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                  <p className="text-xs">No active canvas objects currently loaded.</p>
                  <button onClick={() => initTopicSession(selectedTopic)} className="mt-2 text-xs text-amber-400 underline">Reload Topic defaults</button>
                </div>
              )}
            </div>

            {/* Specialized Active Pedagogical Runtime Experience Controls */}
            <div className="bg-[#f8fafc] p-4 border-t border-[#e2e8f0]">
              {activeExperience === 'BUILD' && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#1e293b]">Dynamic Equivalent Fractions Slicer Lab</h4>
                    <p className="text-[11px] text-[#64748b]">Divide a whole fraction pizza segment into equal parts and pick sections.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-[#64748b]">Slices Division:</span>
                    {[2, 4, 8, 16].map((num) => (
                      <button
                        key={num}
                        onClick={() => handleSliceCountChange(num)}
                        className={`px-3 py-1 text-xs border rounded-lg font-bold transition-all ${
                          fractionSlices === num
                            ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                            : 'bg-white hover:bg-slate-100 text-[#475569] border-[#cbd5e1]'
                        }`}
                      >
                        {num}ths
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeExperience === 'PROCESS' && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#1e293b]">Chloroplast Chemical Process Flow</h4>
                    <p className="text-[11px] text-[#64748b]">Position inputs near chloroplast and spark excitation synthesis.</p>
                  </div>

                  <button
                    onClick={triggerExcitationSimulation}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Simulate Excitation
                  </button>
                </div>
              )}

              {activeExperience === 'SORT' && (
                <div>
                  <h4 className="text-xs font-bold text-[#1e293b] mb-1">Odd / Even Divisibility Sorting Bins</h4>
                  <p className="text-[11px] text-[#64748b]">Select integer cards on the canvas and map them to their correct divisibility target bins.</p>
                </div>
              )}

              {/* Global Alert Outcome Banner */}
              {sortStatus && (
                <div
                  className={`mt-3 p-3 rounded-lg flex items-start gap-2 border text-xs leading-relaxed animate-fade-in ${
                    sortStatus.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-850'
                      : 'bg-amber-50 border-amber-200 text-amber-850'
                  }`}
                >
                  {sortStatus.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <span>{sortStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Equivalent Pizza Slice Graphics Card */}
          {activeExperience === 'BUILD' && (
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569]">Fractions Pizza Interactive Canvas Graphic</h3>
                <span className="text-xs font-bold text-rose-600 font-mono">
                  Active Value: {selectedSlices.size} / {fractionSlices} = {Math.round((selectedSlices.size / fractionSlices) * 100)}%
                </span>
              </div>

              {/* Grid segment selector representing Pizza slices */}
              <div className="flex flex-col items-center justify-center p-4">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 w-full max-w-md">
                  {Array.from({ length: fractionSlices }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleSegment(idx)}
                      className={`h-10 rounded border font-mono font-bold text-xs transition-all ${
                        selectedSlices.has(idx)
                          ? 'bg-rose-500 border-rose-600 text-white shadow-sm scale-105'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-[#cbd5e1]'
                      }`}
                    >
                      Slice {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Platform Semantic, Assets & Session Management */}
        <div id="platform-utilities-column" className="lg:col-span-3 flex flex-col gap-6">
          
          {/* 1. TDBK Semantic Expression Lab */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Calculator className="w-4 h-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700">Semantic Expression Lab</h2>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-bold text-[#64748b]">Expression Inputs Formulation:</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={rawFormulaInput}
                  onChange={(e) => setRawFormulaInput(e.target.value)}
                  placeholder="e.g. 1/2 + 1/4 = 3/4"
                  className="w-full bg-slate-50 border border-[#cbd5e1] text-xs text-[#1e293b] rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Preseed Formulation Quick Buttons */}
              <div className="flex flex-wrap gap-1 pt-1">
                <button
                  onClick={() => setRawFormulaInput('1/2 + 1/4 = 3/4')}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono"
                >
                  ½ + ¼ = ¾
                </button>
                <button
                  onClick={() => setRawFormulaInput('H2O + CO2 -> Sugar + O2')}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono"
                >
                  H₂O + CO₂ &rarr; O₂
                </button>
                <button
                  onClick={() => setRawFormulaInput('7 < 12')}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono"
                >
                  7 &lt; 12
                </button>
              </div>

              {parsedExpression && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px]">
                  <span className="text-[9px] font-bold text-slate-400 block mb-1.5 font-sans uppercase">
                    Compiled Token Stream: ({parsedExpression.category})
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {parsedExpression.tokens.map((tok, idx) => (
                      <span
                        key={idx}
                        title={`Type: ${tok.type}`}
                        className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                          tok.type === 'NUMBER'
                            ? 'bg-rose-950/40 border-rose-900/60 text-rose-300'
                            : tok.type === 'OPERATOR'
                            ? 'bg-amber-950/40 border-amber-900/60 text-amber-300'
                            : tok.type === 'RELATION' || tok.type === 'ARROW'
                            ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
                            : 'bg-indigo-950/40 border-indigo-900/60 text-indigo-300'
                        }`}
                      >
                        {tok.value}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 italic leading-normal border-t border-slate-800 pt-1.5 font-sans">
                    {parsedExpression.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. TDBK Visual Asset Creator */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 mb-3">
              <Image className="w-4 h-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700">Visual Asset Creator</h2>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-bold text-[#64748b]">Concept Illustration Query Prompt:</label>
              <textarea
                rows={2}
                value={visualPrompt}
                onChange={(e) => setVisualPrompt(e.target.value)}
                placeholder="Describe chemical, biological or mathematical element..."
                className="w-full bg-slate-50 border border-[#cbd5e1] text-xs text-[#1e293b] rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />

              <button
                onClick={handleTriggerVisualCreation}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Render Interactive Model
              </button>

              {renderedSvg && (
                <div className="border border-[#e2e8f0] rounded-lg overflow-hidden bg-slate-950 p-2 h-32 flex items-center justify-center">
                  <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: renderedSvg }} />
                </div>
              )}
            </div>
          </div>

          {/* 3. Session State & Persistence Logs */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-600 mb-3">
              <Database className="w-4 h-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">TDBK Session Runtime</h2>
            </div>

            {session ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#64748b] font-medium block">Active Session Identifier:</span>
                  <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded inline-block select-all mt-1">
                    {session.sessionId}
                  </span>
                </div>

                <div className="border-t border-[#f1f5f9] pt-2">
                  <span className="text-[#64748b] font-medium block mb-1">Real-Time Operational Audit Log:</span>
                  <div className="bg-slate-50 border border-[#e2e8f0] rounded-lg p-2.5 max-h-[100px] overflow-y-auto font-mono text-[9px] text-[#475569] space-y-1">
                    {session.historyLog.map((log, idx) => (
                      <div key={idx} className="leading-snug break-words">
                        <span className="text-amber-600 font-bold">&gt;</span> {log}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#f1f5f9] flex gap-2">
                  <button
                    onClick={() => {
                      tdbkSessionRuntime.saveSession(session.sessionId, canvasObjects, { trigger: 'MANUAL_SAVE' });
                      alert(`Session snapshot successfully backed up to browser local storage! ID: ${session.sessionId}`);
                    }}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] border border-[#cbd5e1] transition-all"
                  >
                    Save Snapshot
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Loading active session context...</p>
            )}
          </div>

        </div>

      </main>

      {/* 3. White-Label Standard Branding & Corporate Footer Enforcement */}
      <footer id="classroom-footer" className="bg-white border-t border-[#e2e8f0] py-4 px-6 text-center shadow-inner z-10">
        <p className="text-xs text-[#94a3b8] font-medium">
          Digital Transformation Services • Secure Tenant Layer Isolation • Under System Admin bethuelthuram@gmail.com
        </p>
        <p className="text-xs text-[#64748b] mt-1 font-semibold flex items-center justify-center gap-1">
          <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
          Thuram Digital Bridge Kenya (TDBK) • Multi-Tenant Kernel V2 Platform.
        </p>
      </footer>
    </div>
  );
};
