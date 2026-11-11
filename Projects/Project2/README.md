# My Films & Books Log

## Overview

*My Films & Books Log* is an interactive data visualization built with p5.js (and a Python pipeline in `pipeline.ipynb`) that compares my personal taste in movies and books to the general public's. It uses my film ratings from Letterboxd and my book ratings from StoryGraph. Every film poster and book cover is a plot on a scatter plot: **x = my rating** and **y = the public rating**. The dashed diagonal indicates how closely I agree with the crowd. Covers below it are movies/books I liked more than the crowd, and covers above it are movies/books the crowd liked more than I did.

This app not only shows a log of movies/books I've watched, but also predicts how I would rate the movies/books on my watchlist and to-be-read (TBR) list. If I have watched a movie in my watchlist or read a book in my TBR, I can type in my rating, and the predictions will change accordingly based on this new data.


---

## 📊 My Log at a Glance

| | Count |
| :--- | :--- |
| 🎬 **Movies I've watched** (rated) | **208** |
| 🎬 **Movies on my watchlist** (predicted) | **237** |
| 📚 **Books I've read** (rated) | **28** |
| 📚 **Books on my TBR** (predicted) | **133** |

That is 236 rated items and 370 predicted ones, so 606 covers in total.


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
3. **Images:** posters come from Letterboxd, and most book covers from Open Library and Google Books, and 44 book covers were added by hand and resized (originals are kept in `Data/storygraph/cover_originals/`) for quality and aesthetic purposes. 
4. **Model + export:** the model below is compared against others, then everything the sketch needs is written to `Books_N_Movies/data/viz_data.json`.

---

## How the Rating System Works

### When the app starts
1. The sketch loads `data/viz_data.json`. Each film or book is either **rated** (I gave it a rating) or **unrated** (it's on my watchlist or TBR).
2. It checks the browser for any ratings the user typed in on an earlier visit (`localStorage`) and applies them.
3. It builds the features for every item: the public rating, plus genres, themes, decade, moods and pace.
4. It trains one ridge regression model for films and one for books, **using only the rated items** (208 films, 28 books, plus any you've added).
5. Every unrated item gets a predicted rating, shown as a faded cover at its predicted position. Rated covers stay in full color at my actual rating.

The Python notebook already computed these same predictions. On startup the sketch also checks that its own numbers match the notebook's (they agree to within 0.0005 stars).

### When you type a rating for an unrated movie or book
1. Click a faded cover, type a rating and press `Enter`. The cover turns from a prediction (`≈`) into a rated item (`★`) and moves to the x-position of the rating you typed.
2. That item is now a **training example**. The model for that type (films or books) is **re-trained in your browser** with the new rating included. The other type isn't touched.
3. All of the remaining unrated items get new predictions, and their covers slide to the new positions.
4. A small message shows what happened, like `re-trained on 209 films · 3 predictions moved >0.1★ (avg shift 0.01★)`.

Why predictions only move a little: the film model learns from 208 ratings, so one more nudges it slightly. Films or books that share genres, themes or a decade with the one you rated move the most. The books model has only 28 ratings, so a new book rating changes it more than a new film rating does.

Clearing a rating (the button in the side panel) removes it from the training data and the model re-trains again. All typed ratings stay in your browser only and don't change the data files.

---

## How the Filters Work

The filter dropdown (default: "everything") dims every cover except the ones that have the genre, mood or pace you pick. Nothing is removed or moved, so you can still see where the highlighted covers sit compared to everything else. Each option shows how many covers in the current view have it, like `genre: drama (219)`, and the list is sorted from most to least common.

The options change with the view:

- **Films only:** film genres (19 of them, like drama, comedy and romance). Genres with fewer than 4 films are left out.
- **Books only:** book genres, moods and pace (like `mood: reflective` or `pace: fast`). Again, anything with fewer than 4 books is left out.
- **Films + Books together:** only genres that **both** films and books have, and only ones with at least 6 covers. Moods and pace are books-only, so they disappear here.
- **Predictions on or off:** the counts only include what's in the current view, so a genre has fewer covers in a "my ratings" view than in the same view with predictions.

If you switch to a view that doesn't offer your current filter, it resets to "everything".

### Why films and books share genres
Letterboxd and StoryGraph each label their own genres, and some of the labels are the same word. Nine genres show up on both sides: **crime, fantasy, history, horror, music, mystery, romance, science fiction and thriller**. So picking `romance` in the combined view highlights romance films and romance books together, which is the easiest way to compare these taste across the two.

A few things to know:
- A film or book can have **several genres**, so it shows up under each one. The counts add up to more than the number of covers.
- The same genre word doesn't mean the same thing in both. A fantasy film and a fantasy book are grouped together by label only.
- The model uses these genres too. Films and books are trained separately, but each uses its own genres as features. That's how it notices I lean away from romance and fantasy in both.

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
I'd rate more books to give the model more to learn from, and try features a linear model can't see on its own, like "comedy and 2000s" together.

---

## How People Used It

*To fill in after user testing: who tried it, what they explored first, what surprised or confused them, and what I would change afterward.*

---

## Conclusion
Ultimately, I wanted this project to make my own taste something you can look at and explore, and to be honest about what a model can and can't tell you from a small amount of data. It showed me how much of a data project happens before and after the model: getting the data, deciding what to show, making it clear what I'm trying to show, and being clear about the limits.
