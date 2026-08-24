# ------------------------------------------------------------------------
# studio² brand styling for your waiting-time plot
# Drop this in after your `waiting_by_admission_type` block, in place of
# the current `p_waiting_admission <- ... theme_minimal(base_size = 12)` bit.
#
# Palette (matches styles.css on the site):
#   paper      #f3f1e9   background
#   ink        #10110f   text / axis lines
#   blue       #2547ff   single accent colour (bars, highlights)
#   line       #aaa9a3   axis lines / ticks
#   soft-line  #d2d0c8   gridlines
# Font: "Helvetica Neue" (falls back to Helvetica/Arial) everywhere on site.
# ------------------------------------------------------------------------

library(tidyverse)
library(plotly)

# ---- 0) extended brand palette for categorical charts -------------------
# The site itself is almost monochrome (paper/ink + one blue accent) — fine
# for a single series, but admission_type/department_name need several
# distinguishable colours. Rather than bolting on random hues, this stays
# in the blue family (brand primary + a lighter tint + ink) and adds just
# two carefully chosen outside hues — one warm, one cool — so additional
# categories are still clearly readable without turning the chart into a
# rainbow. Order = priority: use from the top down as category count grows.
studio_palette <- c(
  blue    = "#2547FF",  # brand primary — always the "hero" category
  ink     = "#10110F",  # brand neutral dark
  amber   = "#E0862D",  # warm accent — good for a highlighted/alert category
  petrol  = "#1F8F86",  # cool accent — reads distinct from blue at a glance
  skyblue = "#8FA0FF",  # lighter tint of brand blue — 5th/6th category, or de-emphasised series
  grey    = "#AAA9A3"   # existing line-grey — background/reference category
)

scale_fill_studio <- function(...) scale_fill_manual(values = unname(studio_palette), ...)
scale_color_studio <- function(...) scale_color_manual(values = unname(studio_palette), ...)

# Example: colour the three admission types distinctly instead of one flat blue
# p_waiting_admission + aes(fill = admission_type) + scale_fill_studio()

# For plotly categorical traces (e.g. multiple geom_col groups, or a
# manually-built plot_ly bar chart), pass the same hex values directly:
# plot_ly(..., color = ~admission_type, colors = unname(studio_palette))

# More than 6 categories (e.g. department_name has 8): group the smallest
# into "Sonstige"/"Other" rather than adding a 7th-8th hue — keeps the
# palette editorial instead of diluted.

# ---- 0b) heatmap spectra -------------------------------------------------
# Two continuous scales, both built only from brand colours — no viridis/
# RdYlGn, which would introduce green/yellow the rest of the site never
# uses. Pick sequential vs. diverging based on what the heatmap actually
# encodes:

# SEQUENTIAL — magnitude only, no meaningful zero (occupancy_rate,
# waiting_time_min, visit counts by department x weekday, ...).
# soft-line -> blue -> ink: low values stay visible against the paper
# background instead of washing out to white.
scale_fill_studio_seq <- function(...) {
  scale_fill_gradientn(colours = c("#D2D0C8", "#2547FF", "#10110F"), ...)
}

# DIVERGING — data with a meaningful zero/midpoint (correlation matrices,
# net change, values above/below a benchmark). Same 3 stops used in the
# correlation heatmap already on disziplinen.html.
scale_fill_studio_div <- function(limit = c(-1, 1), ...) {
  scale_fill_gradientn(
    colours = c("#10110F", "#D2D0C8", "#2547FF"),
    limits = limit, ...
  )
}

# Example — sequential, e.g. mean waiting time by department x weekday:
# visits %>%
#   group_by(department_name, weekday) %>%
#   summarise(mean_wait = mean(waiting_time_min), .groups = "drop") %>%
#   ggplot(aes(weekday, department_name, fill = mean_wait)) +
#   geom_tile(colour = "#f3f1e9", linewidth = 0.6) +
#   scale_fill_studio_seq(name = "Ø Wartezeit (Min.)") +
#   coord_equal() +
#   theme_studio()
#
# Example — diverging, e.g. a correlation matrix:
# ggcorr_data %>%
#   ggplot(aes(var1, var2, fill = correlation)) +
#   geom_tile(colour = "#f3f1e9", linewidth = 0.6) +
#   geom_text(aes(label = sprintf("%.2f", correlation),
#                 colour = abs(correlation) > 0.6), size = 3) +
#   scale_fill_studio_div(name = "r") +
#   scale_colour_manual(values = c("#10110F", "#F3F1E9"), guide = "none") +
#   coord_equal() +
#   theme_studio()
# (the scale_colour_manual flips cell-label text to paper-colour once the
#  tile gets dark enough that ink text would no longer be readable)

# ---- 1) a reusable ggplot2 theme ---------------------------------------
theme_studio <- function(base_size = 12) {
  theme_minimal(base_size = base_size, base_family = "Helvetica") %+replace%
    theme(
      plot.background  = element_rect(fill = "transparent", colour = NA),
      panel.background = element_rect(fill = "transparent", colour = NA),
      panel.grid.major = element_line(colour = "#d2d0c8", linewidth = 0.3),
      panel.grid.minor = element_blank(),
      axis.line        = element_line(colour = "#aaa9a3", linewidth = 0.3),
      axis.ticks       = element_line(colour = "#aaa9a3", linewidth = 0.3),
      axis.text        = element_text(colour = "#10110f", size = rel(0.85)),
      axis.title       = element_text(colour = "#10110f", size = rel(0.9)),
      plot.title       = element_text(colour = "#10110f", face = "plain",
                                       size = rel(1.3), hjust = 0, margin = margin(b = 4)),
      plot.subtitle    = element_text(colour = "#10110f", size = rel(0.85),
                                       hjust = 0, margin = margin(b = 14)),
      legend.position  = "none",
      plot.margin      = margin(10, 16, 6, 6)
    )
}

# ---- 1b) theme_studio2() — same theme, with a legend switch -------------
# theme_studio() always turns the legend off (fine for a single-colour bar
# chart), but a heatmap needs its colour scale visible. theme_studio2()
# takes a legend position and additionally restyles the colourbar itself
# (thin, no ticks, ink title/labels) so it reads like part of the layout
# instead of a bolted-on ggplot default.
theme_studio2 <- function(base_size = 12, legend = c("none", "right", "bottom")) {
  legend <- match.arg(legend)
  theme_studio(base_size = base_size) %+replace%
    theme(
      legend.position   = legend,
      legend.title      = element_text(colour = "#10110f", size = rel(0.8)),
      legend.text       = element_text(colour = "#10110f", size = rel(0.75)),
      legend.background = element_rect(fill = "transparent", colour = NA),
      legend.key        = element_rect(fill = "transparent", colour = NA)
    )
}

# apply this once per plot, alongside the scale, so the colourbar itself
# (not just the theme) picks up the thin/no-ticks styling:
studio_colorbar <- function(title = NULL, barheight = grid::unit(3.4, "cm")) {
  guide_colorbar(
    title = title, barwidth = grid::unit(0.28, "cm"), barheight = barheight,
    ticks = FALSE, frame.colour = "#aaa9a3", frame.linewidth = 0.3
  )
}

# ---- 2) your plot, restyled --------------------------------------------
# admission_type has exactly 3 levels (Emergency/Elective/Referral) — a
# perfect fit for the first 3 palette colours instead of one flat blue.
p_waiting_admission <- waiting_by_admission_type %>%
  ggplot(aes(
    x = reorder(admission_type, mean_waiting_time),
    y = mean_waiting_time,
    fill = admission_type
  )) +
  geom_col(width = 0.65) +
  scale_fill_studio() +
  coord_flip() +
  labs(
    title = "Average waiting time by admission type",
    subtitle = "Synthetic hospital operations data",
    x = NULL,
    y = "Mean waiting time in minutes"
  ) +
  theme_studio()

p_waiting_admission

# ---- 3) interactive, brand-matched version (what the site embeds) -----
# ggplotly() converts your ggplot to the same plotly.js object the website
# uses; layout()/config() below apply the exact colours/margins/behaviour
# used for the four charts already on disziplinen.html.
p_interactive <- ggplotly(p_waiting_admission, tooltip = c("x", "y")) %>%
  layout(
    paper_bgcolor = "rgba(0,0,0,0)",
    plot_bgcolor  = "rgba(0,0,0,0)",
    font = list(family = "Helvetica Neue, Helvetica, Arial, sans-serif",
                color = "#10110f", size = 12),
    margin = list(l = 90, r = 24, t = 40, b = 46),
    hoverlabel = list(
      bgcolor = "#ffffff", bordercolor = "#10110f",
      font = list(family = "Helvetica Neue, Helvetica, Arial, sans-serif", color = "#10110f")
    ),
    xaxis = list(gridcolor = "#d2d0c8", zerolinecolor = "#aaa9a3", linecolor = "#aaa9a3"),
    yaxis = list(gridcolor = "#d2d0c8", zerolinecolor = "#aaa9a3", linecolor = "#aaa9a3")
  ) %>%
  config(displayModeBar = FALSE)

p_interactive

# ---- 3b) your heatmap, restyled -----------------------------------------
# mean_waiting_time has no natural zero/midpoint -> sequential scale.
# Changes vs. your version:
#   - scale_fill_studio_seq() instead of ggplot's default teal-purple
#   - thin paper-coloured gaps between tiles (colour = "#f3f1e9") so the
#     grid reads as deliberate, not just default geom_tile edge-to-edge
#   - expand = c(0,0) on both axes: no padding around the tile grid,
#     which otherwise looks like an accidental gap against the frame
#   - only every 3rd hour labelled — 24 tick labels crowd a plot this width
#     (swap scale_x_continuous() for scale_x_discrete(expand = c(0,0)) if
#     admission_hour is a factor rather than a plain integer 0-23 in your
#     waiting_heatmap_data)
#   - theme_studio2(legend = "right") + studio_colorbar() for a thin,
#     tick-less colourbar instead of ggplot's default block
p_waiting_heatmap <- waiting_heatmap_data %>%
  ggplot(aes(
    x = admission_hour,
    y = weekday,
    fill = mean_waiting_time
  )) +
  geom_tile(colour = "#f3f1e9", linewidth = 0.6) +
  scale_fill_studio_seq(guide = studio_colorbar("Ø Wartezeit\n(Min.)")) +
  scale_x_continuous(breaks = seq(0, 23, by = 3), expand = c(0, 0)) +
  scale_y_discrete(expand = c(0, 0)) +
  labs(
    title = "Waiting time by weekday and admission hour",
    subtitle = "Operational pressure becomes visible across time windows",
    x = "Admission hour",
    y = NULL,
    fill = "Mean waiting time"
  ) +
  theme_studio2(legend = "right")

p_waiting_heatmap

# ---- 4) to actually embed this exact chart on the website --------------
# The site loads each chart as a plain {data, layout} JSON blob and calls
# Plotly.newPlot(divId, data, layout) client-side. Export precisely that:
plotly::plotly_json(p_interactive, jsonedit = FALSE)
# -> save this string, drop it into the chart-data JSON on disziplinen.html
#    under a new key (e.g. "waiting_admission"), add a
#    <div id="chart-waiting-admission" class="chart-canvas"></div>
#    and one more mount('chart-waiting-admission', 'waiting_admission')
#    line in the loader script at the bottom of the page.
