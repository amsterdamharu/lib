const requireAll = (requireContext) => { requireContext.keys().map(requireContext); };

// requireAll(require.context('spec/helpers/', true, /\.js$/));
requireAll(require.context('./spec/', true, /.*\.js$/));


