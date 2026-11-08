import React, { useState } from 'react';
import type { CustomQuestionnaireDefinition } from '../../experience/customization/types';

interface Props {
  questionnaire: CustomQuestionnaireDefinition;
  onSubmit: (answers: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export const CustomQuestionnaireView: React.FC<Props> = ({ questionnaire, onSubmit, onCancel }) => {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    try {
      await onSubmit(answers);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The form could not be submitted.');
    } finally { setSubmitting(false); }
  };

  return <section className="mx-auto max-w-3xl space-y-5">
    <header className="rounded-3xl bg-neutral-950 p-6 text-white">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Configured questionnaire</p>
      <h1 className="mt-2 text-2xl font-bold">{questionnaire.title}</h1>
      {questionnaire.description && <p className="mt-2 text-sm text-neutral-300">{questionnaire.description}</p>}
    </header>
    {success ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800"><p>Submission accepted and recorded by the TDBK runtime.</p><button type="button" onClick={onCancel} className="mt-3 rounded-xl border border-emerald-300 px-3 py-2 text-xs font-bold">Return to workspace</button></div> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
      {questionnaire.fields.map(field => <label key={field.id} className="block space-y-1.5 text-sm font-semibold text-neutral-800">
        <span>{field.label}{field.required && <span className="ml-1 text-rose-600">*</span>}</span>
        {field.type === 'TEXTAREA' ? <textarea required={field.required} className="w-full rounded-xl border border-neutral-200 p-3 text-sm font-normal" rows={4} placeholder={field.placeholder} value={String(answers[field.key] ?? '')} onChange={e=>setAnswers(current=>({...current,[field.key]:e.target.value}))}/> :
        field.type === 'SELECT' ? <select required={field.required} className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm font-normal" value={String(answers[field.key] ?? '')} onChange={e=>setAnswers(current=>({...current,[field.key]:e.target.value}))}><option value="">Choose an option</option>{(field.options||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select> :
        field.type === 'MULTI_SELECT' ? <select multiple className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm font-normal" value={Array.isArray(answers[field.key])?answers[field.key] as string[]:[]} onChange={e=>setAnswers(current=>({...current,[field.key]:Array.from(e.target.selectedOptions).map(option=>option.value)}))}>{(field.options||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select> :
        field.type === 'CHECKBOX' ? <input type="checkbox" checked={Boolean(answers[field.key])} onChange={e=>setAnswers(current=>({...current,[field.key]:e.target.checked}))}/> :
        <input required={field.required} type={field.type==='NUMBER'?'number':field.type==='DATE'?'date':'text'} className="w-full rounded-xl border border-neutral-200 p-3 text-sm font-normal" placeholder={field.placeholder} value={String(answers[field.key] ?? '')} onChange={e=>setAnswers(current=>({...current,[field.key]:field.type==='NUMBER'?(e.target.value===''?'':Number(e.target.value)):e.target.value}))}/>}
        {field.helpText && <span className="block text-xs font-normal text-neutral-500">{field.helpText}</span>}
      </label>)}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap justify-between gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-neutral-200 px-4 py-3 text-xs font-bold">Cancel</button><button type="submit" disabled={submitting} className="rounded-xl bg-neutral-950 px-5 py-3 text-xs font-black text-white disabled:opacity-50">{submitting?'Submitting…':questionnaire.submitLabel}</button></div>
    </form>}
  </section>;
};
