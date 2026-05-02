const Spinner = () => {
  return (
    <div className="text-center">
      <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-brand-500 rounded-full animate-spin"></div>
      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  );
}

export default Spinner