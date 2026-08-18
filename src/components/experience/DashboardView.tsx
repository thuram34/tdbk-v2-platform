import React from 'react';
import { DbkExperienceResolved, ExperienceWidget } from '../../experience/types';
import { DynamicIcon } from './IconHelper';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle, Clock, Sparkles } from 'lucide-react';

interface DashboardViewProps {
  experience: DbkExperienceResolved;
  onNavigate: (capabilityId: string) => void;
  onDispatchCommand: (commandType: string, payload: Record<string, unknown>) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  experience,
  onNavigate,
  onDispatchCommand,
}) => {
  const { dashboardWidgets, displayName, sector, terminology, subscriptionTier } = experience;

  return (
    <div className="space-y-6">
      {/* Workspace Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {sector} BLUEPRINT
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {subscriptionTier} TIER
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                {experience.activeBranch.name}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-2">
              {displayName} Operational Command Centre
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Dynamic projection synthesized from Business DNA, Blueprint contracts, active capabilities & branch state.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('discovery')}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Explore Capabilities</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dashboardWidgets.map((widget) => (
          <div
            key={widget.id}
            className={`bg-neutral-900 border border-neutral-800 rounded-lg p-5 ${
              widget.span === 2 ? 'md:col-span-2' : widget.span === 3 ? 'md:col-span-3' : ''
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
                {widget.title}
              </h3>
              {widget.capabilityId && (
                <button
                  onClick={() => onNavigate(widget.capabilityId!)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1 cursor-pointer"
                >
                  <span>Open View</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="mt-4">
              {/* METRIC CARD */}
              {widget.widgetType === 'METRIC_CARD' && (
                <div>
                  <div className="text-2xl font-black text-white">{widget.data.primaryValue}</div>
                  {widget.data.secondaryValue && (
                    <div className="text-xs text-neutral-400 mt-1">{widget.data.secondaryValue}</div>
                  )}
                  {widget.data.trend && (
                    <div className="flex items-center space-x-1 mt-2 text-xs font-semibold text-emerald-400">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>+{widget.data.trend.percentage}% {widget.data.trend.label}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVITY FEED */}
              {widget.widgetType === 'ACTIVITY_FEED' && (
                <div className="space-y-2.5">
                  {widget.data.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded bg-neutral-950 border border-neutral-800/80"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{item.title}</div>
                        {item.subtitle && <div className="text-[11px] text-neutral-400">{item.subtitle}</div>}
                      </div>
                      <div className="text-right">
                        {item.amount && <div className="text-xs font-mono font-bold text-emerald-400">{item.amount}</div>}
                        {item.timestamp && <div className="text-[10px] text-neutral-500 font-mono">{item.timestamp}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* QUEUE LIST */}
              {widget.widgetType === 'QUEUE_LIST' && (
                <div className="space-y-2.5">
                  {widget.data.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded bg-neutral-950 border border-neutral-800/80"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{item.title}</div>
                        {item.subtitle && <div className="text-[11px] text-neutral-400">{item.subtitle}</div>}
                      </div>
                      {item.status && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {item.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ALERT BANNER */}
              {widget.widgetType === 'ALERT_BANNER' && widget.data.alert && (
                <div className="p-3.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Attention Required</div>
                    <div className="text-amber-200/90 mt-0.5">{widget.data.alert.message}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
