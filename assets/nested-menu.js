class NestedMenu extends HTMLElement {
  constructor() {
    super();
    this.menu = this.querySelector('ul');
    this.rows = Array.from(this.menu.querySelectorAll(':scope > li'));
    this.submenus = Array.from(
      this.menu.querySelectorAll(':scope > li > header-details-disclosure'),
    );
    this.tolerance = this.getAttribute('tolerance') || 0;
    this.submenuDirection = this.getAttribute('submenu-direction') || 'right';

    this._activeRow = null;
    this._mouseLocs = [];
    this._lastDelayLoc = null;
    this._timeoutId = null;

    this._MOUSE_LOCS_TRACKED = 3; // number of past mouse locations to track
    this._DELAY = 300; // ms delay when user appears to be entering submenu

    this._boundMouseLeaveMenu = this._mouseleaveMenu.bind(this);
    this._boundMouseEnterRow = this._mouseenterRow.bind(this);
    this._boundClickRow = this._clickRow.bind(this);
    this._boundMouseMoveDocument = this._mousemoveDocument.bind(this);
  }

  connectedCallback() {
    if (window.matchMedia && !window.matchMedia('(any-hover: hover)').matches)
      return;

    this.submenus.forEach((submenu) => {
      submenu.disableListeners();
    });

    this.menu.addEventListener('mouseleave', this._boundMouseLeaveMenu);

    this.rows.forEach((row) => {
      row.addEventListener('mouseenter', this._boundMouseEnterRow);
      row.addEventListener('click', this._boundClickRow);
    });

    document.addEventListener('mousemove', this._boundMouseMoveDocument);
  }

  disconnectedCallback() {
    if (window.matchMedia && !window.matchMedia('(any-hover: hover)').matches)
      return;

    this.menu.removeEventListener('mouseleave', this._boundMouseLeaveMenu);

    this.rows.forEach((row) => {
      row.removeEventListener('mouseenter', this._boundMouseEnterRow);
      row.removeEventListener('click', this._boundClickRow);
    });

    document.removeEventListener('mousemove', this._boundMouseMoveDocument);
  }

  /**
   * Keep track of the last few locations of the mouse.
   */
  _mousemoveDocument(e) {
    this._mouseLocs.push({ x: e.pageX, y: e.pageY });

    if (this._mouseLocs.length > this._MOUSE_LOCS_TRACKED) {
      this._mouseLocs.shift();
    }
  }

  /**
   * Cancel possible row activations when leaving the menu entirely
   */
  _mouseleaveMenu() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
    }

    this._possiblyDeactivate(this._activeRow, this._DELAY);
  }

  /**
   * Trigger a possible row activation whenever entering a new row.
   */
  _mouseenterRow(e) {
    if (this._timeoutId) {
      // Cancel any previous activation delays
      clearTimeout(this._timeoutId);
    }

    // options.enter(this);
    this._possiblyActivate(e.target);
  }

  /*
   * Immediately activate a row if the user clicks on it.
   */
  _clickRow(e) {
    this.activate(e.target);
  }

  openSubmenu(row) {
    if (!row) return;

    const submenu = row.querySelector('header-details-disclosure');

    if (submenu) {
      submenu.mouseEnterListener();
    }
  }

  closeSubmenu(row) {
    if (!row) return;

    const submenu = row.querySelector('header-details-disclosure');

    if (submenu) {
      submenu.mouseLeaveListener();
    }
  }

  /**
   * Activate a menu row.
   */
  activate(row) {
    if (row === this._activeRow) {
      return;
    }

    if (this._activeRow) {
      this.closeSubmenu(this._activeRow);
    }

    this.openSubmenu(row);
    this._activeRow = row;
  }

  /**
   * Possibly activate a menu row. If mouse movement indicates that we
   * shouldn't activate yet because user may be trying to enter
   * a submenu's content, then delay and check again later.
   */
  _possiblyActivate(row) {
    const delay = this._activationDelay();

    if (delay) {
      this._timeoutId = setTimeout(() => {
        this._possiblyActivate(row);
      }, delay);
    } else {
      this.activate(row);
    }
  }

  /**
   * Possibly deactivate a menu row. If mouse movement indicates that we
   * shouldn't deactivate yet because user may be trying to enter
   * a submenu's content, then delay and check again later.
   */
  _possiblyDeactivate(row, initialDelay) {
    const delay = initialDelay ?? this._activationDelay();

    if (delay) {
      this._timeoutId = setTimeout(() => {
        this._possiblyDeactivate(row);
      }, delay);
    } else {
      this.closeSubmenu(row);
      this._activeRow = null;
    }
  }

  /**
   * Return the amount of time that should be used as a delay before the
   * currently hovered row is activated.
   *
   * Returns 0 if the activation should happen immediately. Otherwise,
   * returns the number of milliseconds that should be delayed before
   * checking again to see if the row should be activated.
   */
  _activationDelay() {
    // if (!this._activeRow || !$(activeRow).is(options.submenuSelector)) {
    if (!this._activeRow || !this.rows.includes(this._activeRow)) {
      // If there is no other submenu row already active, then
      // go ahead and activate immediately.
      return 0;
    }

    const offset = {
      top: this.menu.getBoundingClientRect().top + window.scrollY,
      left: this.menu.getBoundingClientRect().left + window.scrollX,
    };
    const upperLeft = {
      x: offset.left,
      y: offset.top - this.tolerance,
    };
    const upperRight = {
      x: offset.left + this.menu.offsetWidth,
      y: upperLeft.y,
    };
    const lowerLeft = {
      x: offset.left,
      y: offset.top + this.menu.offsetHeight + this.tolerance,
    };
    const lowerRight = {
      x: offset.left + this.menu.offsetWidth,
      y: lowerLeft.y,
    };
    const loc = this._mouseLocs[this._mouseLocs.length - 1];
    const prevLoc = this._mouseLocs[0];

    if (!loc) {
      return 0;
    }

    if (!prevLoc) {
      prevLoc = loc;
    }

    if (
      prevLoc.x < offset.left ||
      prevLoc.x > lowerRight.x ||
      prevLoc.y < offset.top ||
      prevLoc.y > lowerRight.y
    ) {
      // If the previous mouse location was outside of the entire
      // menu's bounds, immediately activate.
      return 0;
    }

    if (
      this._lastDelayLoc &&
      loc.x == this._lastDelayLoc.x &&
      loc.y == this._lastDelayLoc.y
    ) {
      // If the mouse hasn't moved since the last time we checked
      // for activation status, immediately activate.
      return 0;
    }

    // Detect if the user is moving towards the currently activated
    // submenu.
    //
    // If the mouse is heading relatively clearly towards
    // the submenu's content, we should wait and give the user more
    // time before activating a new row. If the mouse is heading
    // elsewhere, we can immediately activate a new row.
    //
    // We detect this by calculating the slope formed between the
    // current mouse location and the upper/lower right points of
    // the menu. We do the same for the previous mouse location.
    // If the current mouse location's slopes are
    // increasing/decreasing appropriately compared to the
    // previous's, we know the user is moving toward the submenu.
    //
    // Note that since the y-axis increases as the cursor moves
    // down the screen, we are looking for the slope between the
    // cursor and the upper right corner to decrease over time, not
    // increase (somewhat counterintuitively).
    function slope(a, b) {
      return (b.y - a.y) / (b.x - a.x);
    }

    let decreasingCorner = upperRight;
    let increasingCorner = lowerRight;

    // Our expectations for decreasing or increasing slope values
    // depends on which direction the submenu opens relative to the
    // main menu. By default, if the menu opens on the right, we
    // expect the slope between the cursor and the upper right
    // corner to decrease over time, as explained above. If the
    // submenu opens in a different direction, we change our slope
    // expectations.
    if (this.submenuDirection == 'left') {
      decreasingCorner = lowerLeft;
      increasingCorner = upperLeft;
    } else if (this.submenuDirection == 'below') {
      decreasingCorner = lowerRight;
      increasingCorner = lowerLeft;
    }

    const decreasingSlope = slope(loc, decreasingCorner);
    const increasingSlope = slope(loc, increasingCorner);
    const prevDecreasingSlope = slope(prevLoc, decreasingCorner);
    const prevIncreasingSlope = slope(prevLoc, increasingCorner);

    if (
      decreasingSlope < prevDecreasingSlope &&
      increasingSlope > prevIncreasingSlope
    ) {
      // Mouse is moving from previous location towards the
      // currently activated submenu. Delay before activating a
      // new menu row, because user may be moving into submenu.
      this._lastDelayLoc = loc;
      return this._DELAY;
    }

    this._lastDelayLoc = null;
    return 0;
  }
}
customElements.define('nested-menu', NestedMenu);
