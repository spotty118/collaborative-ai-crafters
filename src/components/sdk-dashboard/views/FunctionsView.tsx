
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Code, Edit, Trash } from 'lucide-react';
import { SDKService } from '@/services/openRouterSDK';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const FunctionsView: React.FC = () => {
  const [functions, setFunctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFunctions = async () => {
      try {
        setLoading(true);
        const data = await SDKService.getFunctions();
        setFunctions(data);
      } catch (error) {
        console.error('Error loading functions:', error);
        toast.error('Failed to load functions');
      } finally {
        setLoading(false);
      }
    };
    
    loadFunctions();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Functions</h1>
        <Button className="flex items-center">
          <Plus size={16} className="mr-2" />
          Register Function
        </Button>
      </div>

      {loading ? (
        <Card className="p-4">
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start justify-between">
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-64 mb-2" />
                  <div className="flex gap-1">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : functions.length === 0 ? (
        <Card className="p-8 text-center">
          <Code size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No functions available</h3>
          <p className="text-gray-500 mb-6">Register a function to enhance agent capabilities</p>
          <Button>
            <Plus size={16} className="mr-2" />
            Register First Function
          </Button>
        </Card>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Function Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parameters</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {functions.map(func => (
                <tr key={func.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{func.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{func.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {func.parameters.map((param: string) => (
                      <span key={param} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-1">
                        {param}
                      </span>
                    ))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Button variant="link" size="sm" className="h-8 p-0">
                        Use in Agent
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Edit size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Trash size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FunctionsView;
