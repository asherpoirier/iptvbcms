import React, { useState, useEffect } from 'react';
import { adminAPI } from '../api/api';
import { toast } from 'sonner';
import {
  ArrowRightLeft, Server, Users, Package, AlertTriangle, CheckCircle2,
  XCircle, ChevronRight, Loader2, History, Shield, RefreshCw
} from 'lucide-react';

const PANEL_TYPE_LABELS = {
  xtream: 'XtreamUI',
  xuione: 'XuiOne',
  onestream: '1-Stream',
  nxtdash: 'NXT Dash',
  aether: 'Aether',
  gold: 'Gold',
  ghostpanel: 'Ghost Panel',
  ghostsurf: 'GhostSurf VPN',
};

const PANEL_TYPE_COLORS = {
  xtream: 'bg-blue-500',
  xuione: 'bg-cyan-500',
  onestream: 'bg-green-500',
  nxtdash: 'bg-orange-500',
  aether: 'bg-purple-500',
  gold: 'bg-amber-500',
  ghostpanel: 'bg-violet-500',
  ghostsurf: 'bg-teal-500',
};

export default function PanelMigration({ settings }) {
  const [step, setStep] = useState(1);
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sourcePanel, setSourcePanel] = useState(null);
  const [destPanel, setDestPanel] = useState(null);
  const [preview, setPreview] = useState(null);
  const [packageMapping, setPackageMapping] = useState({});
  const [migrateUsersToPanel, setMigrateUsersToPanel] = useState(true);
  const [preserveCredentials, setPreserveCredentials] = useState(true);
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrationLogs, setMigrationLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetchPanels();
  }, []);

  const fetchPanels = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getMigrationPanels();
      setPanels(res.data.panels || []);
    } catch (err) {
      toast.error('Failed to load panels: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await adminAPI.getMigrationLogs();
      setMigrationLogs(res.data.logs || []);
    } catch (err) {
      toast.error('Failed to load migration logs');
    }
  };

  const handlePreview = async () => {
    if (!sourcePanel || !destPanel) {
      toast.error('Please select both source and destination panels');
      return;
    }
    if (sourcePanel.type === destPanel.type && sourcePanel.index === destPanel.index) {
      toast.error('Source and destination panels must be different');
      return;
    }
    setLoading(true);
    try {
      const res = await adminAPI.getMigrationPreview({
        source_type: sourcePanel.type,
        source_index: sourcePanel.index,
        dest_type: destPanel.type,
        dest_index: destPanel.index,
      });
      setPreview(res.data);
      // Initialize package mapping
      const mapping = {};
      (res.data.source?.products || []).forEach((prod) => {
        mapping[prod._id] = '';
      });
      setPackageMapping(mapping);
      setStep(2);
    } catch (err) {
      toast.error('Preview failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!preview) return;
    // Validate package mapping
    const unmapped = Object.entries(packageMapping).filter(([, v]) => !v);
    if (unmapped.length > 0 && preview.source?.products?.length > 0) {
      toast.error('Please map all source products to destination packages');
      return;
    }
    setExecuting(true);
    try {
      const res = await adminAPI.executeMigration({
        source_type: sourcePanel.type,
        source_index: sourcePanel.index,
        dest_type: destPanel.type,
        dest_index: destPanel.index,
        package_mapping: packageMapping,
        migrate_users_to_panel: migrateUsersToPanel,
        preserve_credentials: preserveCredentials,
      });
      setMigrationResult(res.data);
      setStep(3);
      toast.success('Migration completed!');
    } catch (err) {
      toast.error('Migration failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setExecuting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSourcePanel(null);
    setDestPanel(null);
    setPreview(null);
    setPackageMapping({});
    setMigrateUsersToPanel(true);
    setPreserveCredentials(true);
    setMigrationResult(null);
    fetchPanels();
  };

  const panelKey = (p) => `${p.type}-${p.index}`;

  const PanelCard = ({ panel, selected, onClick, disabled }) => (
    <button
      onClick={() => !disabled && onClick(panel)}
      disabled={disabled}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
          : disabled
          ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${PANEL_TYPE_COLORS[panel.type] || 'bg-gray-500'} flex items-center justify-center`}>
          <Server className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white truncate">{panel.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {PANEL_TYPE_LABELS[panel.type] || panel.type}
          </div>
          {panel.url && (
            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{panel.url}</div>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {panel.users} users</span>
        <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {panel.products} products</span>
        <span className="flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> {panel.services} services</span>
      </div>
      {panel.can_create_users && (
        <div className="mt-2">
          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
            API Migration Supported
          </span>
        </div>
      )}
    </button>
  );

  // ========== STEP 1: Select Panels ==========
  const renderStep1 = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Step 1: Select Panels</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose the source panel to migrate from and the destination panel to migrate to.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : panels.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Server className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No panels configured. Add panels in the Panels settings first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Source Panel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Source Panel (migrate FROM)
            </label>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {panels.map((panel) => (
                <PanelCard
                  key={panelKey(panel)}
                  panel={panel}
                  selected={sourcePanel && panelKey(sourcePanel) === panelKey(panel)}
                  onClick={(p) => { setSourcePanel(p); if (destPanel && destPanel.category !== p.category) setDestPanel(null); }}
                  disabled={destPanel && panelKey(destPanel) === panelKey(panel)}
                />
              ))}
            </div>
          </div>

          {/* Destination Panel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Destination Panel (migrate TO)
            </label>
            {sourcePanel && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                Showing only {sourcePanel.category === 'vpn' ? 'VPN' : 'IPTV'} panels (must match source category)
              </p>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {panels.filter(panel => !sourcePanel || panel.category === sourcePanel.category).map((panel) => (
                <PanelCard
                  key={panelKey(panel)}
                  panel={panel}
                  selected={destPanel && panelKey(destPanel) === panelKey(panel)}
                  onClick={setDestPanel}
                  disabled={sourcePanel && panelKey(sourcePanel) === panelKey(panel)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview Button */}
      {sourcePanel && destPanel && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 font-medium shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            Preview Migration
          </button>
        </div>
      )}
    </div>
  );

  // ========== STEP 2: Preview & Package Mapping ==========
  const renderStep2 = () => {
    if (!preview) return null;
    const { source, destination } = preview;
    return (
      <div>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Step 2: Preview & Configure</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review the migration details and map source products to destination packages.
          </p>
        </div>

        {/* Migration Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Source */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Source</div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${PANEL_TYPE_COLORS[source.type] || 'bg-gray-500'} flex items-center justify-center`}>
                <Server className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-sm">{source.name}</div>
                <div className="text-xs text-gray-500">{PANEL_TYPE_LABELS[source.type]}</div>
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex justify-between"><span>Users:</span> <span className="font-medium">{preview.total_users}</span></div>
              <div className="flex justify-between"><span>Services:</span> <span className="font-medium">{preview.total_services}</span></div>
              <div className="flex justify-between"><span>Products:</span> <span className="font-medium">{preview.total_products}</span></div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <ArrowRightLeft className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Destination */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Destination</div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${PANEL_TYPE_COLORS[destination.type] || 'bg-gray-500'} flex items-center justify-center`}>
                <Server className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-sm">{destination.name}</div>
                <div className="text-xs text-gray-500">{PANEL_TYPE_LABELS[destination.type]}</div>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span>Available packages: </span>
              <span className="font-medium">{(destination.packages || []).length}</span>
            </div>
          </div>
        </div>

        {/* Package Mapping Table */}
        {(source.products || []).length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Package Mapping</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Source Product</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-600 dark:text-gray-300">→</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300">Destination Package</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {source.products.map((prod) => (
                    <tr key={prod._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{prod.name || prod.package_name || 'Unnamed'}</div>
                        <div className="text-xs text-gray-500">ID: {prod._id}</div>
                      </td>
                      <td className="text-center px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={packageMapping[prod._id] || ''}
                          onChange={(e) => setPackageMapping((prev) => ({ ...prev, [prod._id]: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select package...</option>
                          {(destination.packages || []).map((pkg) => (
                            <option key={pkg.id || pkg.package_id} value={pkg.id || pkg.package_id}>
                              {pkg.name || pkg.package_name || `Package ${pkg.id || pkg.package_id}`}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Options Toggles */}
        <div className="mb-6 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={migrateUsersToPanel}
              onChange={(e) => setMigrateUsersToPanel(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Create users on destination panel</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Actually provision users via the destination panel's API</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preserveCredentials}
              onChange={(e) => setPreserveCredentials(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Preserve credentials (same username/password)</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Keep the same login credentials on the new panel</div>
            </div>
          </label>
        </div>

        {/* Warning Banner */}
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800 dark:text-amber-200">This action is irreversible</div>
            <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Migration will update billing records, service associations, and optionally create users on the destination panel.
              This cannot be undone automatically. Make sure your package mapping is correct before proceeding.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Back
          </button>
          <button
            onClick={handleExecute}
            disabled={executing}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 disabled:opacity-50 font-medium shadow-sm"
          >
            {executing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Migrating...</>
            ) : (
              <><Shield className="w-4 h-4" /> Execute Migration</>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ========== STEP 3: Migration Results ==========
  const renderStep3 = () => {
    if (!migrationResult) return null;
    const r = migrationResult;
    return (
      <div>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Step 3: Migration Results</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Migration completed. Review the results below.</p>
        </div>

        {/* Result Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{r.users_migrated || 0}</div>
            <div className="text-xs text-green-700 dark:text-green-300 mt-1">Users Migrated</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{r.users_failed || 0}</div>
            <div className="text-xs text-red-700 dark:text-red-300 mt-1">Users Failed</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{r.users_skipped || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Users Skipped</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{r.services_updated || 0}</div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">Services Updated</div>
          </div>
        </div>

        {/* Products Updated */}
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium">Products updated:</span> {r.products_updated || 0}
        </div>

        {/* Success/Failure Banner */}
        {r.success ? (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-green-800 dark:text-green-200 font-medium">Migration completed successfully with no errors.</span>
          </div>
        ) : (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800 dark:text-red-200 font-medium">Migration completed with errors</span>
            </div>
            {(r.errors || []).length > 0 && (
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1 ml-7">
                {r.errors.map((err, i) => (
                  <li key={i}>{typeof err === 'string' ? err : JSON.stringify(err)}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => { setShowLogs(true); fetchLogs(); }}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <History className="w-4 h-4" /> View Migration Logs
          </button>
          <button
            onClick={resetWizard}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Start New Migration
          </button>
        </div>
      </div>
    );
  };

  // ========== Migration Logs ==========
  const renderLogs = () => (
    <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <History className="w-5 h-5" /> Migration History
        </h3>
        <button
          onClick={() => setShowLogs(false)}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Hide
        </button>
      </div>
      {migrationLogs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No migration logs found.</p>
      ) : (
        <div className="space-y-3">
          {migrationLogs.map((log, idx) => (
            <div key={log._id || idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {log.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.source} → {log.destination}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {log.started_at ? new Date(log.started_at).toLocaleString() : 'Unknown'}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="text-green-600">✓ {log.users_migrated || 0} migrated</span>
                <span className="text-red-600">✗ {log.users_failed || 0} failed</span>
                <span>⊘ {log.users_skipped || 0} skipped</span>
                <span className="text-blue-600">↻ {log.services_updated || 0} services</span>
              </div>
              {(log.errors || []).length > 0 && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {log.errors.length} error(s): {log.errors[0]}{log.errors.length > 1 ? ` (+${log.errors.length - 1} more)` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ========== Step Indicator ==========
  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              step >= s
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            {s}
          </div>
          {s < 3 && (
            <div className={`flex-1 h-0.5 ${step > s ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Panel Migration</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Migrate users, products, and services between panels</p>
          </div>
        </div>
      </div>

      <StepIndicator />

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

      {showLogs && renderLogs()}
    </div>
  );
}
