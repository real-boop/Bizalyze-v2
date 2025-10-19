const isProd = process.env.NODE_ENV === 'production';

const logger = {
  debug: (...args: any[]) => { if (!isProd) console.debug('[DEBUG]', ...args); },
  info:  (...args: any[]) => { if (!isProd) console.info('[INFO]', ...args); },
  error: (...args: any[]) => { console.error('[ERROR]', ...args); }
};

export default logger; 