import React, { useMemo, useState } from 'react';
import type { DbkExperienceResolved } from '../../experience/types';
import type { CustomWorkflowDefinition, CustomWorkflowRun } from '../../experience/customization/types';
import { CustomQuestionnaireView } from './CustomQuestionnaireView';
import { CheckCircle2, Circle, Play, ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  experience: DbkExperienceResolved;
  workflow: CustomWorkflowDefinition;
  onDispatchCommand: (commandType: string, payload: Record<string, unknown>) => Promise<any>;
  onClose: () => void;
}

export const CustomWorkflowView: React.FC<Props> = ({ experience, workflow, onDispatchCommand, onClose }) => {
  const [run, setRun] = useState<CustomWorkflowRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentStep = useMemo(() => run ? workflow.steps[run.currentStepIndex] : undefined, [run, workflow.steps]);

  const start = async () => {
    setBusy(true); setError('');
    try {
      const result = await onDispatchCommand('START_WORKFLOW', { workflowId: workflow.id });
      const nextRun = result?.commandResponse?.result?.workflowRun as CustomWorkflowRun | undefined;
      if (!nextRun) throw new Error('The TDBK runtime did not return a workflow run.');
      setRun(nextRun);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start workflow.'); }
    finally { setBusy(false); }
  };

  const advance = async (stepId: string) => {
    if (!run) return;
    setBusy(true); setError('');
    try {
      const result = await onDispatchCommand('ADVANCE_WORKFLOW', { workflowRunId: run.runId, stepId });
      const nextRun = result?.commandResponse?.result?.workflowRun as CustomWorkflowRun | undefined;
      if (!nextRun) throw new Error('The TDBK runtime did not return the updated workflow state.');
      setRun(nextRun);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete workflow step.'); }
    finally { setBusy(false); }
  };

  const submitQuestionnaire = async (questionnaireId: string, answers: Record<string, unknown>) => {
    if (!run || !currentStep) throw new Error('Start the workflow before submitting this step.');
    const result = await onDispatchCommand('SUBMIT_QUESTIONNAIRE', {
      questionnaireId, answers, workflowRunId: run.runId, workflowStepId: currentStep.id,
    });
    const nextRun = result?.commandResponse?.result?.workflowRun as CustomWorkflowRun | undefined;
    if (!nextRun) throw new Error('The questionnaire was recorded but workflow state was not returned.');
    setRun(nextRun);
  };

  const currentQuestionnaire = currentStep?.questionnaireId
    ? experience.customization?.questionnaires.find(item => item.id === currentStep.questionnaireId && item.enabled)
    : undefined;

  return <div className="mx-auto max-w-4xl space-y-5">
    <header className="rounded-3xl bg-neutral-950 p-6 text-white">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">TDBK · Guided workflow</p>
      <h1 className="mt-2 text-2xl font-bold">{workflow.name}</h1>
      {workflow.description && <p className="mt-2 text-sm text-neutral-300">{workflow.description}</p>}
      <p className="mt-3 text-xs text-neutral-400">{experience.displayName} · {workflow.steps.length} steps</p>
    </header>

    {!run ? <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="font-bold">Ready to begin?</h2>
      <p className="mt-1 text-sm text-neutral-500">Starting creates a tenant-scoped workflow run. Each step is recorded as it is completed.</p>
      <button type="button" onClick={start} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black text-white disabled:opacity-50"><Play size={14}/>{busy?'Starting…':'Start workflow'}</button>
    </div> : <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Workflow progress</p>
        <div className="mt-3 space-y-3">{workflow.steps.map((step,index)=>{
          const complete=run.completedStepIds.includes(step.id);
          const active=run.currentStepIndex===index && run.status==='IN_PROGRESS';
          return <div key={step.id} className="flex items-start gap-2.5">
            {complete?<CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600"/>:<Circle className={`mt-0.5 h-4 w-4 ${active?'text-neutral-900':'text-neutral-300'}`}/>}
            <div><p className={`text-xs font-semibold ${active?'text-neutral-950':'text-neutral-500'}`}>{index+1}. {step.title}</p>{step.assigneeRole&&<p className="mt-0.5 text-[10px] text-neutral-400">{step.assigneeRole}</p>}</div>
          </div>;
        })}</div>
        <p className="mt-4 break-all text-[10px] text-neutral-400">Run ID: {run.runId}</p>
      </aside>
      <section className="space-y-4">
        {run.status==='COMPLETED' ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><CheckCircle2 className="h-8 w-8 text-emerald-600"/><h2 className="mt-3 text-lg font-bold text-emerald-900">Workflow completed</h2><p className="mt-1 text-sm text-emerald-800">All configured steps have been recorded for this run.</p></div> :
        currentStep ? currentQuestionnaire ? <CustomQuestionnaireView key={currentStep.id} questionnaire={currentQuestionnaire} onCancel={onClose} onSubmit={answers=>submitQuestionnaire(currentQuestionnaire.id,answers)}/> :
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Step {run.currentStepIndex+1} of {workflow.steps.length}</p>
          <h2 className="mt-2 text-xl font-bold">{currentStep.title}</h2>
          {currentStep.description&&<p className="mt-2 text-sm text-neutral-500">{currentStep.description}</p>}
          {currentStep.assigneeRole&&<p className="mt-3 text-xs text-neutral-500">Assigned role: <strong>{currentStep.assigneeRole}</strong></p>}
          <button type="button" onClick={()=>advance(currentStep.id)} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<ArrowRight size={14}/>}Complete step</button>
        </div> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">The current workflow step is unavailable. Contact the workspace administrator.</p>}
      </section>
    </div>}
    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <button type="button" onClick={onClose} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-xs font-bold text-neutral-700">Close workflow</button>
  </div>;
};
