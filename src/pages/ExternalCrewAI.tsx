import CrewAIConnector from '../components/CrewAIConnector';
import { Card } from '../components/ui/card';

export default function ExternalCrewAI() {
  const handleResultReceived = (result: Record<string, unknown>) => {
    console.log('Result received from CrewAI:', result);
    // Here you could store the result in your application state
    // or perform any other operations with the data
  };

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">External CrewAI Integration</h1>
          <p className="text-gray-500">
            This page demonstrates integration with an external CrewAI API endpoint.
          </p>
        </div>

        <Card className="p-6 bg-slate-50">
          <h2 className="text-xl font-semibold mb-4">API Information</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Deployment Name:</span>{' '}
              <code className="bg-slate-100 px-2 py-1 rounded">
                could_you_clarify_if_this_chat_is_intended_to_focus_on_crew_automation_use_cases
              </code>
            </div>
            <div>
              <span className="font-medium">API URL:</span>{' '}
              <code className="bg-slate-100 px-2 py-1 rounded">
                https://could-you-clarify-if-this-chat-is-intended--fc133f12.crewai.com
              </code>
            </div>
            <div>
              <span className="font-medium">Authentication:</span>{' '}
              <span>Bearer Token (configured in the application)</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
            <p className="text-sm">
              <strong>Note:</strong> This integration uses the CrewAI API hosted externally. The API 
              provides three endpoints:
            </p>
            <ul className="list-disc list-inside mt-2 text-sm space-y-1">
              <li><code className="bg-yellow-100 px-1">GET /inputs</code> - Retrieve required inputs</li>
              <li><code className="bg-yellow-100 px-1">POST /kickoff</code> - Start a new crew task</li>
              <li><code className="bg-yellow-100 px-1">GET /status/{'{task_id}'}</code> - Check execution status</li>
            </ul>
          </div>
        </Card>

        <CrewAIConnector onResultReceived={handleResultReceived} />
      </div>
    </div>
  );
}
