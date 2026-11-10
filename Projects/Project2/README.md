# My Films & Books Log

## Overview

*My Films & Books Log* is an interactive data visualization built with p5.js (and a Python pipeline in `pipeline.ipynb`) that compares my personal taste in movies and books to the general public's. It uses my film ratings from Letterboxd and my book ratings from StoryGraph. Every film poster and book cover is a plot on a scatter plot: **x = my rating** and **y = the public rating**. The dashed diagonal indicates how closely I agree with the crowd. Covers below it are movies/books I liked more than the crowd, and covers above it are movies/books the crowd liked more than I did.

This app not only shows a log of movies/books I've watched, but also predicts how I would rate the movies/books on my watchlist and to-be-read (TBR) list. If I have watched a movie in my watchlist or read a book in my TBR, I can type in my rating, and the predictions will change accordingly based on this new data.


## Core Design Principles & Intentions

### 1. Let the Data Be the Interface
The data points plotted are the real movie posters and book covers to show a visual representation that the user (including myself) can easily associate with the data presented. Part of the fun, I feel, when looking at the data is being able to quickly identify what movies and books I've rated and how that differs or is aligned with the general public's rating. I also took out most of the explanatory text I tend to add. This time, I really wanted to leave room for people to be curious and explore the data on their own instead of reading instructions first, whcih is what I have learned from Project 1.

### 2. One Visual Cue for "Known vs. Guessed"
Saturation is the only thing separating what I rated from what the model predicted. The rated covers are in full color and the predicted covers are faded. Hovering on a cover enlarges it, boosts its saturation and shows its rating (`★ 4` for a rating I gave, `≈ 4.16` for a prediction, where the `≈` signals that it's approximate prediction value).

### 3. A Unifying Aesthetic
The dark background, Courier New font and gold (films - Letterboxd's color palette) / green (books - StoryGraph's color palette) accents are consistent across every view, and keep the same text style as my earlier projects.

### 4. Controls That Make Sense for What You're Looking At
The filter dropdown only offers choices that belong to the current view: film genres for films, genres, moods and pace for books, and only the genres both films and books share when they're shown together. 

---

## User Interaction & Interface

| Feature | Key / Control | Function |
| :--- | :--- | :--- |
| **Views** | `1` – `6` or click a tab | Switch between films, books, both, and each with predictions (see below). |
| **Hover** | Mouse | Enlarge a cover and show its rating and details in the side panel. |
| **Filter** | Dropdown | Dim everything except a genre, mood or pace. |
| **Zoom** | Scroll wheel | Zoom in around the mouse (the 4–5★ area is crowded). |
| **Pan** | Click & drag | Move around when zoomed in. |
| **Reset zoom** | Double-click or `0` | Return to the full plot. |
| **Rate it yourself** | Click a faded cover, type a rating, `Enter` | Re-trains the model in the browser and moves the other predictions. |
| **Deselect** | `Esc` or click empty space | Close the rating box. |

The six views are:

1. Films, my ratings
2. Books, my ratings
3. Films + Books, my ratings
4. Films, my ratings + predicted ratings for my watchlist
5. Books, my ratings + predicted ratings for my TBR list
6. Everything (Films + Books), my ratings + predictions

Ratings typed in by the user are saved in the browser (`localStorage`), and a button in the side panel clears them.

---

## The Data Pipeline

All the cleaning, scraping and modeling is in `Books_N_Movies/pipeline.ipynb`:

1. **Acquire:** Letterboxd's public pages were scraped for genres, themes, public rating and poster. StoryGraph blocks scripts, so I entered the public rating, genres, moods and pace for the books.
2. **Clean:** the exports were merged with the public stats and the ratings parsed.
3. **Images:** posters come from Letterboxd, and book covers from Open Library and Google Books. 14 books have no cover found, so they show a lettered placeholder.
4. **Model + export:** the model below is compared against others, then everything the sketch needs is written to `Books_N_Movies/data/viz_data.json`.

---

## The Model

**Ridge regression.** This is a linear regression with a penalty on large coefficients, which keeps the model from overfitting. That matters here because I only have about 208 rated films and 28 rated books, but lots of possible features (every genre, theme, mood, pace and decade). It's also easy to read and re-trains instantly in the browser when a rating is entered.

**kNN (k-nearest neighbors).** This predicts a rating from the most similar films or books I've already rated. I used it as a comparison because it works very differently from ridge, with no coefficients to read.

Both models are tuned on a validation set and scored on a held-out test set, over 20 random 60/20/20 splits. For background on the bias–variance trade-off, train/test splits and regularization, I referenced [Dr. Chelsea Pelleriti's lecture from Chapman University](https://www.youtube.com/watch?v=u6kKOldSYs8&list=PLmxpwhh4FDm5zuA_63jV6iiz5wrg76UHV&index=7).

Mean test error (in stars), lower is better:

| | Films | Books |
|---|---|---|
| **Ridge (chosen)** | 0.45 | 0.71 |
| Always guess my average | 0.62 | 0.75 |
| Public rating only | 0.46 | 0.78 |
| kNN | 0.47 | 0.67 |
| Random forest | 0.46 | 0.70 |

What the films model picked up: I lean towards 2000s films, comedy/satire and family films, and away from 2020s films, romance and fantasy.

What the books model picked up: I lean towards classics, literary fiction and reflective, adventurous or mysterious books, and away from romance, fantasy and historical books. With only 28 rated books these weights are not super accurate.

---

## Process & Reflection

### Getting the data
Most of the work was the pipeline. Letterboxd was scrapeable from the public data on each film page, but StoryGraph sits behind a Cloudflare challenge that blocks scripts.

### Things that went wrong
- **Covers piled on top of each other.** About 70 films share the same 5★ column (yes, I am very generous with my ratings), so my first layout was a bit messy. Pushing covers apart made it worse until I limited how far a cover can drift from its true position and added zoom and pan.
- **Resizing broke the plot.** The axes scaled with the window but the covers stayed at their old pixel positions. I fixed it by moving the covers relative to the plot instead of the screen.
- **Loading ~600 images at once** made my local server drop connections, so the sketch loads a few at a time and retries.
- **Two versions of one model.** The model runs in Python (for evaluation) and JavaScript (for live re-training), so I added a check on startup that they agree. They match to within 0.0005 stars.

### What the model can and can't do
For films, ridge's error is about 0.45 stars versus 0.62 for always guessing my average. But the public rating alone gets 0.46, so my genres and themes add very little: my taste is close to the crowd's. For books, with only 28 ratings, ridge barely beats guessing my average (0.71 vs 0.75), so books are much tougher to predict. kNN was a bit better on books, but its answers change a lot when a single book is added, and it can't explain why. A single typed-in rating also only nudges the other predictions slightly (about 0.01 stars on average). That is expected for a regularized model, but it is less dramatic than I had first imagined.

### Future enhancements
I'd rate more books to give the model more to learn from, find covers for the remaining 14, and try features a linear model can't see on its own, like "comedy and 2000s" together.

---

## How People Used It

*To fill in after user testing: who tried it, what they explored first, what surprised or confused them, and what I would change afterward.*

---

## Conclusion
Ultimately, I wanted this project to make my own taste something you can look at and explore, and to be honest about what a model can and can't tell you from a small amount of data. It showed me how much of a data project happens before and after the model: getting the data, deciding what to show, making it clear what I'm trying to show, and being clear about the limits.
