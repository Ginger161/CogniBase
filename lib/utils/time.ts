export function formatSmartTime(dateInput: string | number | Date | { seconds: number } | null | undefined): string {
  if (!dateInput) return 'Just now';

  let date: Date;
  if (typeof dateInput === 'object' && 'seconds' in dateInput) {
    date = new Date(dateInput.seconds * 1000);
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.max(0, diffMs / 1000);
  const diffMins = diffSecs / 60;
  const diffHours = diffMins / 60;

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${Math.floor(diffMins)}m ago`;
  } else if (diffHours < 4) {
    return `${Math.floor(diffHours)}h ago`;
  } else {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'long', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}
