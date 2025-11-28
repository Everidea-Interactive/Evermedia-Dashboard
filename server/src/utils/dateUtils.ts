/**
 * Formats a date string or Date object to dd/mm/yyyy format
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date string in dd/mm/yyyy format
 */
export function formatDate(date: string | Date | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
}


