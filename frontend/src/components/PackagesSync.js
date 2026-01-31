import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Server, Download, Check } from 'lucide-react';

export default function PackagesSync() {
  const queryClient = useQueryClient();
  const [packages, setPackages] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  
  const { data: existingProducts } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const response = await adminAPI.getProducts();
      return response.data;
    },
  });

  const syncPackagesMutation = useMutation({
    mutationFn: () => adminAPI.syncPackagesFromPanel(),
    onSuccess: (response) => {
      setPackages(response.data.packages || []);
      alert(`Success! Fetched ${response.data.packages?.length || 0} packages from XtreamUI panel!`);
    },
    onError: (error) => {
      alert('Sync failed: ' + (error.response?.data?.detail || error.message));
    },
  });

  const importPackagesMutation = useMutation({
    mutationFn: async (packagesToImport) => {
      const results = [];
      
      for (const pkg of packagesToImport) {
        const durationMonths = convertDurationToMonths(pkg.duration, pkg.duration_unit);
        
        const productData = {
          name: pkg.name,
          description: `${pkg.name} - ${pkg.max_connections} connection(s), ${pkg.duration} ${pkg.duration_unit}`,
          account_type: 'subscriber',
          bouquets: pkg.bouquets.map(b => parseInt(b.id)),
          max_connections: pkg.max_connections,
          reseller_credits: 0,
          reseller_max_lines: 0,
          trial_days: 0,
          prices: {
            [durationMonths]: parseFloat(pkg.credits)
          },
          active: true,
        };
        
        try {
          await adminAPI.createProduct(productData);
          results.push({ success: true, package: pkg.name });
        } catch (error) {
          results.push({ success: false, package: pkg.name, error: error.message });
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries(['admin-products']);
      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      alert(`Import complete! ${success} packages imported successfully${failed > 0 ? `, ${failed} failed` : ''}.`);
      setSelectedPackages([]);
    },
  });

  const handleSync = () => {
    syncPackagesMutation.mutate();
  };

  const handleSelectPackage = (packageId) => {
    setSelectedPackages(prev => 
      prev.includes(packageId) 
        ? prev.filter(id => id !== packageId)
        : [...prev, packageId]
    );
  };

  const handleImport = () => {
    const packagesToImport = packages.filter(pkg => selectedPackages.includes(pkg.id));
    
    if (packagesToImport.length === 0) {
      alert('Please select at least one package to import');
      return;
    }
    
    if (window.confirm(`Import ${packagesToImport.length} package(s) as products?`)) {
      importPackagesMutation.mutate(packagesToImport);
    }
  };

  const isPackageImported = (pkg) => {
    return existingProducts?.some(p => p.name === pkg.name);
  };

  const convertDurationToMonths = (duration, unit) => {
    switch (unit) {
      case 'days': return Math.max(1, Math.ceil(duration / 30));
      case 'months': return duration;
      case 'years': return duration * 12;
      default: return duration;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Packages from XtreamUI</h3>
        <p className="text-sm text-gray-600 mb-4">
          Fetch packages from your XtreamUI panel and import them as products automatically.
        </p>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-900 mb-1">Sync Packages from XtreamUI</p>
              <p className="text-xs text-green-700">
                Fetches all available packages with pricing, duration, and bouquet information
              </p>
            </div>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncPackagesMutation.isPending}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Server className="w-5 h-5" />
              {syncPackagesMutation.isPending ? 'Syncing...' : 'Sync Packages'}
            </button>
          </div>
        </div>
      </div>

      {packages.length > 0 && (
        <>
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Available Packages ({packages.length} total)
              </label>
              <button
                type="button"
                onClick={handleImport}
                disabled={selectedPackages.length === 0 || importPackagesMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
              >
                <Download className="w-4 h-4" />
                {importPackagesMutation.isPending ? 'Importing...' : `Import Selected (${selectedPackages.length})`}
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
              {packages.map((pkg) => {
                const imported = isPackageImported(pkg);
                const durationMonths = convertDurationToMonths(pkg.duration, pkg.duration_unit);
                
                return (
                  <div
                    key={pkg.id}
                    className={`p-4 rounded-lg border-2 transition ${
                      imported
                        ? 'bg-green-50 border-green-300'
                        : selectedPackages.includes(pkg.id)
                        ? 'bg-blue-50 border-blue-400'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedPackages.includes(pkg.id)}
                        onChange={() => handleSelectPackage(pkg.id)}
                        disabled={imported}
                        className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">{pkg.name}</h4>
                          {imported && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Imported
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">Price:</span>
                            <span className="ml-2 font-semibold text-green-600">${pkg.credits}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Duration:</span>
                            <span className="ml-2 font-semibold text-gray-900">{durationMonths} month{durationMonths > 1 ? 's' : ''}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Connections:</span>
                            <span className="ml-2 font-semibold text-gray-900">{pkg.max_connections}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Bouquets:</span>
                            <span className="ml-2 font-semibold text-blue-600">{pkg.bouquets?.length || 0}</span>
                          </div>
                        </div>
                        {pkg.bouquets && pkg.bouquets.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            <strong>Includes:</strong> {pkg.bouquets.slice(0, 5).map(b => b.bouquet_name).join(', ')}
                            {pkg.bouquets.length > 5 && ` +${pkg.bouquets.length - 5} more`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Importing packages will create new products with pricing and settings from your XtreamUI panel. 
              Already imported packages cannot be re-imported to prevent duplicates.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
