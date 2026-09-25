/**
 * Wraps async express route handlers to catch uncaught rejections and pass them to next()
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
