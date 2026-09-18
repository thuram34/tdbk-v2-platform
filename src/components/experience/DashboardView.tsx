import React from 'react';
import { DbkExperienceResolved, ExperienceWidget } from '../../experience/types';
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
  const { dashboardWidgets, displayName, sector, subscriptionTier } = experience;

  const renderTrend = (widget: ExperienceWidget) => {
    const trend = widget.data.trend;
    if (!trend) return null;

    const isDown = trend.direction === 'DOWN';
    const isNeutral = trend.direction === 'NEUTRAL';
    const TrendIcon = isDown ? ArrowDownRight : isNeutral ? Clock : ArrowUpRight;
    const trendClass = isDown
      ? 'text-rose-400'
      : isNeutral
        ? 'text-neutral-400'
        : 'text-emerald-400';

    return (
      <div className={`flex items-center space-x-1 mt-2 text-xs font-semibold ${trendClass}`}>
        <TrendIcon className="w-3.5 h-3.5" />
        <span>{!isNeutral && (isDown ? '-' : '+')}{trend.percentage}% {trend.label}</span>
      </div>
    );
  };

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
              {/* METRIC CARD / FINANCIAL SUMMARY */}
              {(widget.widgetType === 'METRIC_CARD' || widget.widgetType === 'FINANCIAL_SUMMARY') && (
                <div>
                  <div className="text-2xl font-black text-white">{widget.data.primaryValue}</div>
                  {widget.data.secondaryValue && (
                    <div className="text-xs text-neutral-400 mt-1">{widget.data.secondaryValue}</div>
                  )}
                  {renderTrend(widget)}
                </div>
              )}

              {/* ACTIVITY FEED */}
              {widget.widgetType === 'ACTIVITY_FEED' && (
                <div className="space-y-2.5">
                  {widget.data.items?.map((item, index) => (
                    <div
                      key={item.id ?? `${widget.id}-activity-${index}`}
                      className="flex items-center justify-between p-2.5 rounded bg-neutral-950 border border-neutral-800/80"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{item.title ?? item.name ?? item.id ?? 'Activity'}</div>
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
                  {widget.data.items?.map((item, index) => {
                    const title = item.title ?? item.patient ?? item.name ?? item.id ?? 'Queue item';
                    const subtitle = item.subtitle ?? item.waitTime;
                    const status = item.status ?? item.priority;

                    return (
                      <div
                        key={item.id ?? `${widget.id}-queue-${index}`}
                        className="flex items-center justify-between p-2.5 rounded bg-neutral-950 border border-neutral-800/80"
                      >
                        <div>
                          <div className="text-xs font-semibold text-white">{title}</div>
                          {subtitle && <div className="text-[11px] text-neutral-400">{subtitle}</div>}
                        </div>
                        {status && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {status}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ALERT FEED */}
              {widget.widgetType === 'ALERT_FEED' && (
                <div>
                  {widget.data.primaryValue && (
                    <div className="text-2xl font-black text-white">{widget.data.primaryValue}</div>
                  )}
                  {widget.data.secondaryValue && (
                    <div className="text-xs text-neutral-400 mt-1">{widget.data.secondaryValue}</div>
                  )}
                  {widget.data.items && widget.data.items.length > 0 && (
                    <div className="space-y-2.5 mt-4">
                      {widget.data.items.map((item, index) => (
                        <div
                          key={item.id ?? item.sku ?? `${widget.id}-alert-${index}`}
                          className="flex items-center justify-between p-2.5 rounded bg-amber-500/5 border border-amber-500/20"
                        >
                          <div className="flex items-center gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <div>
                              <div className="text-xs font-semibold text-white">{item.name ?? item.title ?? item.sku ?? 'Stock alert'}</div>
                              {item.sku && <div className="text-[10px] text-neutral-500 font-mono">{item.sku}</div>}
                            </div>
                          </div>
                          {typeof item.qty === 'number' && typeof item.min === 'number' && (
                            <div className="text-right">
                              <div className="text-xs font-mono font-bold text-amber-300">{item.qty} left</div>
                              <div className="text-[10px] text-neutral-500">min {item.min}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STATUS CARD */}
              {widget.widgetType === 'STATUS_CARD' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded bg-neutral-950 border border-neutral-800 p-3">
                    <div className="text-lg font-black text-emerald-400">{widget.data.statusSummary?.active ?? 0}</div>
                    <div className="text-[10px] text-neutral-500 uppercase">Active</div>
                  </div>
                  <div className="rounded bg-neutral-950 border border-neutral-800 p-3">
                    <div className="text-lg font-black text-amber-400">{widget.data.statusSummary?.pending ?? 0}</div>
                    <div className="text-[10px] text-neutral-500 uppercase">Pending</div>
                  </div>
                  <div className="rounded bg-neutral-950 border border-neutral-800 p-3">
                    <div className="text-lg font-black text-rose-400">{widget.data.statusSummary?.flagged ?? 0}</div>
                    <div className="text-[10px] text-neutral-500 uppercase">Flagged</div>
                  </div>
                </div>
              )}

              {/* ACTION GRID */}
              {widget.widgetType === 'ACTION_GRID' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {widget.actions?.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => onDispatchCommand(action.command, { widgetId: widget.id, actionId: action.id })}
                      className="text-left p-3 rounded bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition"
                    >
                      <div className="text-xs font-semibold text-white">{action.label}</div>
                      <div className="text-[10px] text-neutral-500 mt-1 font-mono">{action.command}</div>
                    </button>
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

              {/* Empty-state guard */}
              {['METRIC_CARD', 'ACTIVITY_FEED', 'QUEUE_LIST', 'STATUS_CARD', 'ACTION_GRID', 'ALERT_BANNER', 'FINANCIAL_SUMMARY', 'ALERT_FEED'].includes(widget.widgetType) === false && (
                <div className="text-xs text-neutral-500">Unsupported dashboard widget.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
