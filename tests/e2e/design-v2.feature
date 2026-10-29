Feature: Design v2 (2026-10-29) — bottom navigation, honest roles, dual scheme, anchored total, empty states
  Acts as the .feature doc for design-v2.mjs; every bullet is a named claim (ids D1–D6) in tasks/design-v2.md.

  Scenario: navigation lives in the thumb zone
    Given the app renders any tab
    Then the navigation bar is a fixed full-bleed bottom sheet (z below the toast)
    And the active tab shows the MD3 nav-bar indicator (secondary-container pill behind the icon)
    And the toast rule lifts above the bar so it never covers a tab cell

  Scenario: button roles are honest
    Given Save and Apply render
    Then they stay filled-primary
    And Export is an outlined secondary action
    And Clear wears the error role and keeps its two-tap confirm

  Scenario: the scheme follows the OS
    Given the OS prefers dark
    Then the same role ladder re-tones (surface/primary/ok differ from the light defaults)
    And the emulation restores light for the remaining checks

  Scenario: the month's money is the anchor
    Given the Bills tab renders
    Then the total paints on a tonal block with the STR caption and a big figure

  Scenario: empty states are honest
    Given a fresh profile with no saved months
    Then the History tab paints the STR emptyHistory state
    And every bar-less chart paints the STR emptyCharts state
