import { CheckIcon } from '@heroicons/react/24/solid';

const STEPS = [
  { title: 'Property', description: 'Create the property profile' },
  { title: 'Unit', description: 'Add a room, apartment, or space' },
  { title: 'Tenant', description: 'Assign the new tenant' },
  { title: 'Record Payment', description: 'Capture the first payment' },
];

type SetupFlowStepperProps = {
  currentStep: number;
};

export default function SetupFlowStepper({ currentStep }: SetupFlowStepperProps) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/70 p-4 shadow-sm dark:border-brand-800 dark:bg-brand-900/70">
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={step.title} className="flex min-w-[165px] items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold ${
                  isCompleted
                    ? 'border-success bg-success text-white'
                    : isCurrent
                      ? 'border-primary bg-primary text-white'
                      : 'border-brand-200 bg-brand-50 text-brand-500 dark:border-brand-700 dark:bg-brand-800'
                }`}
              >
                {isCompleted ? <CheckIcon className="h-5 w-5" /> : index + 1}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isCurrent ? 'text-primary' : 'text-brand-900 dark:text-white'}`}>
                  {step.title}
                </p>
                <p className="text-xs text-brand-500">{step.description}</p>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`hidden h-px flex-1 md:block ${index < currentStep ? 'bg-success' : 'bg-brand-200 dark:bg-brand-700'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
