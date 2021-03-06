/*
 * Queues loading of diff fragments from a page.
 *
 * This is used to load diff fragments one-by-one, and to intelligently
 * batch the loads to only fetch at most one set of fragments per file.
 */
RB.DiffFragmentQueueView = Backbone.View.extend({
    events: {
        'click .diff-expand-btn': '_onExpandButtonClicked',
        'click .diff-collapse-btn': '_onCollapseButtonClicked'
    },

    // The timeout for a mouseout event to fire after it actually occurs.
    _timeout: 500,

    initialize: function() {
        this._queue = {};
        this._$window = $(window);
        this._$collapseButtons = $();
        this._mouse = { x: NaN, y: NaN };

        _.bindAll(this, '_onExpandOrCollapseFinished', '_onMouseMove',
                  '_onScrollOrResize', '_updateCollapseButtonPos');

        this._$window.on('scroll', this._onScrollOrResize);
        this._$window.on('resize', this._onScrollOrResize);
    },

    /*
     * Remove this from the DOM and set all the elements it references to null
     */
    remove: function() {
        RB.AbstractReviewableView.prototype.remove.call(this);

        this._$collapseButtons = null;

        this._$window.off('scroll', this._updateCollapseButtonPos);
        this._$window.off('resize', this._updateCollapseButtonPos);
        this._$window = null;
        this._active = null;
    },

    /*
     * Queues the load of a diff fragment from the server.
     *
     * This will be added to a list, which will fetch the comments in batches
     * based on file IDs.
     */
    queueLoad: function(comment_id, key) {
        var queue = this._queue;

        if (!queue[key]) {
            queue[key] = [];
        }

        queue[key].push(comment_id);
    },

    /*
     * Begins the loading of all diff fragments on the page belonging to
     * the specified queue.
     */
    loadFragments: function() {
        var queueName = this.options.queueName,
            urlPrefix,
            urlSuffix;

        if (!this._queue) {
            return;
        }

        urlPrefix = this.options.reviewRequestPath +
                    'fragments/diff-comments/';
        urlSuffix = '/?queue=' + queueName +
                    '&container_prefix=' + this.options.containerPrefix +
                    '&' + AJAX_SERIAL;

        _.each(this._queue, function(comments) {
            var url = urlPrefix + comments.join(',') + urlSuffix;

            $.funcQueue(queueName).add(_.bind(function() {
                this._addScript(url,
                                _.bind(function() {
                                    _.each(comments, this._onFirstLoad, this);
                                }, this)
                );
            }, this));
        }, this);

        // Clear the list.
        this._queue = {};

        $.funcQueue(queueName).start();
    },

    /*
     * When the expand button is clicked, trigger loading of a new diff
     * fragment with context.
     */
    _onExpandButtonClicked: function(e) {
        e.preventDefault();
        this._expandOrCollapse($(e.target).closest('.diff-expand-btn'), e);
    },

    /*
     * When the collapse button is clicked, trigger loading of a new diff
     * fragment with context.
     */
    _onCollapseButtonClicked: function(e) {
        e.preventDefault();
        this._expandOrCollapse($(e.target).closest('.diff-collapse-btn'), e);
    },

    /*
     * Handle a scroll or resize by updating the button positions.
     */
    _onScrollOrResize: function() {
        this._updateCollapseButtonPos();
    },

    /*
     * Update the positions of the collapse buttons.
     *
     * This will attempt to position the collapse buttons such that they're
     * in the center of the exposed part of the expanded diff fragment in the
     * current viewport.
     *
     * As the user scrolls, they'll be able to see the button scroll along
     * with them. It will not, however, leave the confines of the table.
     */
    _updateCollapseButtonPos: function() {
        var windowTop,
            windowHeight,
            len = this._$collapseButtons.length,
            $button,
            $chunks,
            $firstChunk,
            $lastChunk,
            chunkTop,
            chunkBottom,
            chunkHeight,
            i;

        if (len === 0) {
            return;
        }

        windowTop = this._$window.scrollTop();
        windowHeight = this._$window.height();

        for (i = 0; i < len; i++) {
            $button = $(this._$collapseButtons[i]);

            /*
             * We are only showing one button per table. If we try to use the
             * table to position the element, we get jumpy behaviour. Instead
             * we use the first and last expanded chunks in the table and
             * position relative to them.
             */
            $chunks = $button
                .closest('.sidebyside')
                .children('tbody')
                .not('.diff-header');

            $firstChunk = $($chunks.get(0));
            $lastChunk = $($chunks.get(-1));

            chunkTop = $firstChunk.offset().top;
            chunkBottom = $lastChunk.offset().top + $lastChunk.height();

            // The effective height of the chunks we are working with.
            chunkHeight = chunkBottom - chunkTop;

            if (chunkTop >= windowTop + windowHeight) {
                // We've gone past the last visible button.
                break;
            } else if (chunkTop + chunkHeight <= windowTop) {
                // We haven't reached a visible button yet.
            } else {
                if (   windowTop >= chunkTop
                    && windowTop + windowHeight <= chunkBottom) {
                    if ($button.css('position') !== 'fixed') {
                        /*
                         * Position in the center of the screen once so it will
                         * be less jumpy.
                         */
                        $button.css({
                            position: 'fixed',
                            left: $button.offset().left,
                            top: Math.round((windowHeight -
                                             $button.outerHeight) / 2)
                        });
                    }

                    /*
                     * The table is taking up the entire screen so we have
                     * nothing else to process.
                     */
                    break;
                } else {
                    var top = Math.max(windowTop, chunkTop);
                    var bottom = Math.min(windowTop + windowHeight,
                                          chunkBottom);

                    /*
                     * The area doesn't take up the entire height of the view.
                     * Switch back to an absolute position.
                     */
                    $button.css({
                        position: 'absolute',
                        left: '',
                        top: top - chunkTop +
                             Math.round((bottom - top -
                                         $button.outerHeight()) / 2)
                    });
                }
            }

        }
    },

    /*
     * Add the given context above and below to the fragment corresponding to
     * the comment id.
     */
    _expandOrCollapse: function($btn, clickEvent) {
        var id = $btn.data('comment-id'),
            linesOfContext = $btn.data('lines-of-context'),
            url = this.options.reviewRequestPath + 'fragments/diff-comments/' +
                  id + '/?container_prefix=' + this.options.containerPrefix +
                  '&lines_of_context=' + linesOfContext + '&' + AJAX_SERIAL;

        /*
         * We need the mouse position so we can determine if we are still
         * hovering over the same element when the new fragment finishes
         * loading.
         */
        this._onMouseMove(clickEvent);

        this._addScript(url, this._onExpandOrCollapseFinished, id);

        RB.setActivityIndicator(true, {'type': 'GET'});
    },

    /*
     * Show the controls on the specified comment container.
     */
    _showControls: function($container) {
        $container.find('td > div').not('.collapse-floater').slideDown('slow');
    },

    /*
     * Hide the controls on the specified comment container.
     */
    _hideControls: function($container) {
        $container.find('td > div').not('.collapse-floater').slideUp('slow');
    },

    /*
     * Adds a script tag for a diff fragment to the bottom of the page. An
     * optional callback is added to the load event of the script tag. It is
     * called with the specified optional params.
     */
    _addScript: function(url, callback, params) {
        var e = document.createElement('script');

        e.type = 'text/javascript';
        e.src = url;

        if (callback !== undefined) {
            e.addEventListener('load', function () {
                callback(params);
            });
        }

        document.body.appendChild(e);
    },

    /*
     * Handle a mousemove event and update the position we know for the mouse.
     */
    _onMouseMove: function(event) {
        if (event !== undefined) {
            this._mouse.x = event.clientX;
            this._mouse.y = event.clientY;
        } else {
            this._mouse.x = NaN;
            this._mouse.y = NaN;
        }
    },

    /*
     * Handle a expand or collapse finishing (i.e., the associated script tag
     * finished loading).
     */
    _onExpandOrCollapseFinished: function(id) {
        var $expanded = this.$('#' + this.options.containerPrefix + '_' + id);
        this._$collapseButtons = this.$('.diff-collapse-btn');
        this._updateCollapseButtonPos('table');

        RB.setActivityIndicator(false, {});

        /* We only need mousemove events for a short period of time. */
        this._$window.on('mousemove', this._onMouseMove);

        _.delay(_.bind(function() {
            /*
             * Find the element the mouse is hovering over. This may or may not
             * be a comment container.
             */
            var atPoint = document.elementFromPoint(this._mouse.x,
                                                    this._mouse.y),
                $over = $(atPoint).closest('.comment_container');

            this._$window.off('mousemove', this._onMouseMove);

            /*
             * Are we still over top of the element that we expanded? If not
             * we should hide the controls of the expanded element.
             */
            if ($over.get(0) !== $expanded.get(0)) {
                this._hideControls($expanded);
            }
        }, this), this._timeout);
    },

    /*
     * When a comment container loads its contents for the first time, hide its
     * controls and set up the mouseenter and mouseleave events.
     */
    _onFirstLoad: function(id) {
        var $container = this.$('#' + this.options.containerPrefix + '_' + id);

        // Don't use _hideControls so that becomes invisible immediately.
        $container.find('td > div').not('.collapse-floater').hide();

        $container.hoverIntent({
            timeout: this._timeout,
            over: _.bind(function() { this._showControls($container); }, this),
            out: _.bind(function() { this._hideControls($container); }, this)
        });
    }
});
