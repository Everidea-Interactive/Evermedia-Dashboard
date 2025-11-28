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

/**
 * Formats a date string or Date object to dd/mm/yyyy HH:mm format
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date-time string in dd/mm/yyyy HH:mm format
 */
export function formatDateTime(date: string | Date | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formats a date for chart display (e.g., "15 Jan" or "15/01")
 * @param date - Date string, Date object, or timestamp
 * @param format - 'short' for "15 Jan" or 'numeric' for "15/01"
 * @returns Formatted date string
 */
export function formatDateForChart(date: string | Date | number, format: 'short' | 'numeric' = 'numeric'): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  if (format === 'short') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    return `${day} ${month}`;
  } else {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  }
}

/**
 * Parses a date string in dd/mm/yyyy format or other common formats
 * @param dateString - Date string in dd/mm/yyyy, yyyy-mm-dd, or other formats
 * @returns Date object or null if invalid
 */
export function parseDate(dateString: string): Date | null {
  if (!dateString || !dateString.trim()) {
    return null;
  }

  const trimmed = dateString.trim();
  
  // Try dd/mm/yyyy format first
  const ddMmYyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddMmYyyyMatch) {
    const [, day, month, year] = ddMmYyyyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    // Validate the date (check if it's a valid date and matches the input)
    if (date.getDate() === parseInt(day) && date.getMonth() === parseInt(month) - 1 && date.getFullYear() === parseInt(year)) {
      return date;
    }
  }
  
  // Try yyyy-mm-dd format (ISO format)
  const yyyyMmDdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyyMmDdMatch) {
    const [, year, month, day] = yyyyMmDdMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (date.getDate() === parseInt(day) && date.getMonth() === parseInt(month) - 1 && date.getFullYear() === parseInt(year)) {
      return date;
    }
  }
  
  // Fallback to JavaScript's Date constructor (handles various formats)
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
}

