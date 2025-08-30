document.addEventListener('DOMContentLoaded', function() {
    let loading = false;
    // grab initial URL
    let nextUrl = document.querySelector('.mrk-grid-wrapper')?.dataset.url || '';
  
    // debounce helper
    function debounce(fn, wait) {
      let t;
      return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    }
  
    // window.addEventListener('scroll', debounce(() => {
    //   const scrollFraction = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
    //   console.log(scrollFraction);
    //   if (scrollFraction >= 0 && !loading && nextUrl) {
    //     const loader = document.querySelector('.mrk-loader-wrapper');
    //     if(loader)
    //     loadMoreContent(loader);
    //   }
    // }, 200), { passive: true });
    setTimeout(function(){
      const loader = document.querySelector('.mrk-loader-wrapper');
      if(loader)
      loadMoreContent(loader);
    },100)
    async function loadMoreContent(loader) {
        // Prevent multiple loads
        if (loader.classList.contains('loading')) return;
        loader.classList.add('loading');

        try {
            // Get the last grid wrapper
            const gridWrappers = document.querySelectorAll('.mrk-grid-wrapper');
            const lastGridWrapper = gridWrappers[gridWrappers.length - 1];
            const nextUrl = document.querySelector('.mrk-grid-wrapper').dataset.url;

            // Check if there's a URL to load
            if (!nextUrl || nextUrl.trim() === '') {
                // No more content to load, remove the loader
                loader.remove();
                return;
            }

            // Fetch the next page
            const response = await fetch(nextUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Find the new grid wrapper in the response
            const newGridWrapper = doc.querySelector('.mrk-grid-wrapper');
            if (!newGridWrapper) throw new Error('No grid wrapper found in response');

            // Insert the new content after the last grid wrapper
            lastGridWrapper.insertAdjacentHTML('beforeend', newGridWrapper.innerHTML);
            var section = newGridWrapper.closest('section').getAttribute('data-section-id');
            const sectionClass = `.section--${section}`;
            if (document.body.dataset.animLoad === 'true') {
              setTimeout(function(){
                window.sr.reveal(`
                  ${sectionClass} .collection__filters-active,
                  ${sectionClass} .collection-pagination,
                  ${sectionClass} .section__title,
                  ${sectionClass} .search-page__form,
                  ${sectionClass} .search-page__info
                `, { distance: 0, delay: 50 });
                window.sr.reveal(`${sectionClass} .product-card-top, ${sectionClass} .search-grid-item`, {
                  interval: theme.intervalValue,
                  delay: 0
                });
              },100)
            }
            // Check if the new content has another URL
            const newNextUrl = newGridWrapper.dataset.url;
            if (!newNextUrl || newNextUrl.trim() === '') {
                // No more content to load, remove the loader
                loader.remove();
            }else{
              document.querySelector('.mrk-grid-wrapper').dataset.url = newNextUrl;
              
            }
        } catch (error) {
            console.error('Error loading more content:', error);
            // Optional: Show error message or retry logic
        } finally {
            loader.classList.remove('loading');
            const mrk_loader = document.querySelector('.mrk-loader-wrapper');
            console.log(mrk_loader);
              if(mrk_loader)
              loadMoreContent(mrk_loader);
        }
    }
});