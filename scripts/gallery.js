(function () {
    "use strict";

    const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
    const PAINTING_GRID_WIDTH = 960;
    const PAINTING_CAROUSEL_WIDTH = 1800;

    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
    const photoOpenButton = document.getElementById("openPhotoCarouselBtn");
    const paintingOpenButton = document.getElementById("openPaintingCarouselBtn");
    const paintingGrid = document.getElementById("paintingGrid");
    const paintingStatus = document.getElementById("paintingStatus");
    const overlay = document.getElementById("galleryCarousel");
    const closeButton = document.getElementById("closeCarouselBtn");
    const prevButton = document.getElementById("carouselPrevBtn");
    const nextButton = document.getElementById("carouselNextBtn");
    const carouselImage = document.getElementById("carouselImage");
    const carouselCount = document.getElementById("carouselCount");
    const carouselCaption = document.getElementById("carouselCaption");
    const carouselTitle = document.getElementById("carouselTitle");
    const carouselMetadata = document.getElementById("carouselMetadata");
    const carouselSource = document.getElementById("carouselSource");
    const collageImages = Array.from(document.querySelectorAll("#photoGrid img"));

    if (!overlay || !closeButton || !prevButton || !nextButton || !carouselImage || !carouselCount) {
        return;
    }

    const photoSourcesSet = new Set(
        collageImages
            .map((image) => image.getAttribute("src"))
            .filter(Boolean)
    );
    const largePaintingUrls = new Map();
    let photos = sortPhotoSources(Array.from(photoSourcesSet));
    let paintings = [];
    let paintingTiles = [];
    let activeCollection = "photos";
    let currentIndex = 0;
    let isOpen = false;
    let previouslyFocusedElement = null;

    function activateTab(tabName, updateHash) {
        const selectedTab = tabs.find((tab) => tab.dataset.galleryTab === tabName) || tabs[0];
        if (!selectedTab) {
            return;
        }

        tabs.forEach((tab) => {
            const isSelected = tab === selectedTab;
            tab.setAttribute("aria-selected", String(isSelected));
            tab.tabIndex = isSelected ? 0 : -1;
        });

        panels.forEach((panel) => {
            panel.hidden = panel.id !== selectedTab.getAttribute("aria-controls");
        });

        if (updateHash) {
            history.replaceState(null, "", "#" + selectedTab.dataset.galleryTab);
        }

        if (selectedTab.dataset.galleryTab === "paintings") {
            requestAnimationFrame(layoutPaintingGrid);
        }
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener("click", function () {
            activateTab(tab.dataset.galleryTab, true);
        });

        tab.addEventListener("keydown", function (event) {
            let nextIndex = null;
            if (event.key === "ArrowRight") {
                nextIndex = (index + 1) % tabs.length;
            } else if (event.key === "ArrowLeft") {
                nextIndex = (index - 1 + tabs.length) % tabs.length;
            } else if (event.key === "Home") {
                nextIndex = 0;
            } else if (event.key === "End") {
                nextIndex = tabs.length - 1;
            }

            if (nextIndex !== null) {
                event.preventDefault();
                tabs[nextIndex].focus();
                activateTab(tabs[nextIndex].dataset.galleryTab, true);
            }
        });
    });

    activateTab(window.location.hash === "#paintings" ? "paintings" : "photos", false);
    window.addEventListener("hashchange", function () {
        activateTab(window.location.hash === "#paintings" ? "paintings" : "photos", false);
    });

    function extractPhotoNumber(path) {
        const match = path.match(/photo-(\d+)/i);
        return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    }

    function sortPhotoSources(list) {
        return list.slice().sort((a, b) => {
            const aNumber = extractPhotoNumber(a);
            const bNumber = extractPhotoNumber(b);
            if (aNumber !== bNumber) {
                return aNumber - bNumber;
            }
            return a.localeCompare(b);
        });
    }

    function imageExists(src) {
        return new Promise((resolve) => {
            const probe = new Image();
            probe.onload = function () {
                resolve(true);
            };
            probe.onerror = function () {
                resolve(false);
            };
            probe.src = src;
        });
    }

    function normalizeListedImagePath(directory, href) {
        if (!href) {
            return null;
        }

        const stripped = href.split("#")[0].split("?")[0];
        if (!/\.(avif|gif|jpe?g|png|webp)$/i.test(stripped) || /^https?:\/\//i.test(stripped)) {
            return null;
        }

        if (stripped.startsWith("/")) {
            return stripped.slice(1);
        }

        if (stripped.includes("/")) {
            return stripped.startsWith(directory) ? stripped : null;
        }

        return directory + stripped;
    }

    async function discoverFromDirectoryListing(directory) {
        try {
            const response = await fetch(directory, { cache: "no-store" });
            if (!response.ok) {
                return;
            }

            const html = await response.text();
            const hrefMatches = html.match(/href=["'][^"']+["']/gi) || [];
            hrefMatches.forEach((match) => {
                const normalizedPath = normalizeListedImagePath(directory, match.slice(6, -1));
                if (normalizedPath) {
                    photoSourcesSet.add(normalizedPath);
                }
            });
        } catch (error) {
            return;
        }
    }

    async function discoverAdditionalPhotos() {
        const firstSource = photos[0];
        if (!firstSource) {
            return;
        }

        const directoryIndex = firstSource.lastIndexOf("/");
        const directory = directoryIndex !== -1 ? firstSource.slice(0, directoryIndex + 1) : "";
        if (directory) {
            await discoverFromDirectoryListing(directory);
        }

        const patternMatch = firstSource.match(/^(.*photo-)(\d+)(\.[a-z0-9]+)$/i);
        if (!patternMatch) {
            photos = sortPhotoSources(Array.from(photoSourcesSet));
            return;
        }

        const prefix = patternMatch[1];
        const width = patternMatch[2].length;
        const extension = patternMatch[3];
        let consecutiveMisses = 0;

        for (let number = 1; number <= 250 && consecutiveMisses < 8; number += 1) {
            const candidate = prefix + String(number).padStart(width, "0") + extension;
            if (photoSourcesSet.has(candidate)) {
                consecutiveMisses = 0;
                continue;
            }

            if (await imageExists(candidate)) {
                photoSourcesSet.add(candidate);
                consecutiveMisses = 0;
            } else {
                consecutiveMisses += 1;
            }
        }

        photos = sortPhotoSources(Array.from(photoSourcesSet));
    }

    function commonsTitleFromUrl(value) {
        try {
            const url = new URL(value);
            const prefix = "/wiki/";
            if (url.hostname !== "commons.wikimedia.org" || !url.pathname.startsWith(prefix)) {
                return null;
            }

            const title = decodeURIComponent(url.pathname.slice(prefix.length));
            return title.startsWith("File:") ? title : null;
        } catch (error) {
            return null;
        }
    }

    function normalizedTitle(value) {
        return value.replace(/_/g, " ");
    }

    function fallbackPaintingTitle(fileTitle) {
        return normalizedTitle(fileTitle)
            .replace(/^File:/, "")
            .replace(/\.[^.]+$/, "")
            .replace(/\s+-\s+Google Art Project$/i, "");
    }

    function commonsFileRedirect(fileTitle, width) {
        const filename = fileTitle.replace(/^File:/, "");
        return "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + encodeURIComponent(filename) + "?width=" + width;
    }

    function metadataText(field) {
        if (!field || !field.value) {
            return "";
        }

        const parsed = new DOMParser().parseFromString(field.value, "text/html");
        parsed.querySelectorAll('script, style, [style*="display: none"], [style*="display:none"]').forEach((node) => node.remove());
        return (parsed.body.textContent || "").replace(/\s+/g, " ").trim();
    }

    async function fetchCommonsInformation(fileTitles, width, includeMetadata) {
        const pages = [];

        for (let start = 0; start < fileTitles.length; start += 20) {
            const params = new URLSearchParams({
                action: "query",
                format: "json",
                formatversion: "2",
                origin: "*",
                prop: "imageinfo",
                titles: fileTitles.slice(start, start + 20).join("|"),
                iiprop: includeMetadata ? "url|size|extmetadata" : "url|size",
                iiurlwidth: String(width)
            });

            if (includeMetadata) {
                params.set("iiextmetadatalanguage", "en");
                params.set(
                    "iiextmetadatafilter",
                    "Artist|ObjectName|DateTimeOriginal|Credit|LicenseShortName|LicenseUrl|UsageTerms|AttributionRequired"
                );
            }

            const response = await fetch(COMMONS_API + "?" + params.toString());
            if (!response.ok) {
                throw new Error("Wikimedia Commons returned " + response.status);
            }

            const data = await response.json();
            if (data.query && Array.isArray(data.query.pages)) {
                pages.push(...data.query.pages);
            }
        }

        return pages;
    }

    function buildPainting(entry, fileTitle, page) {
        const info = page && page.imageinfo && page.imageinfo[0];
        if (!info || !info.thumburl) {
            return null;
        }

        const metadata = info.extmetadata || {};
        const title = entry.title || metadataText(metadata.ObjectName) || fallbackPaintingTitle(fileTitle);
        const artist = entry.artist || metadataText(metadata.Artist) || "Unknown artist";

        return {
            fileTitle,
            sourceUrl: entry.url,
            thumbUrl: info.thumburl,
            carouselFallbackUrl: commonsFileRedirect(fileTitle, PAINTING_CAROUSEL_WIDTH),
            width: info.thumbwidth || info.width,
            height: info.thumbheight || info.height,
            title,
            artist,
            date: entry.date || metadataText(metadata.DateTimeOriginal),
            medium: entry.medium || "",
            dimensions: entry.dimensions || "",
            collection: entry.collection || "",
            credit: entry.credit || metadataText(metadata.Credit),
            license: entry.license || metadataText(metadata.LicenseShortName) || metadataText(metadata.UsageTerms),
            licenseUrl: entry.licenseUrl || metadataText(metadata.LicenseUrl),
            alt: entry.alt || title + " by " + artist
        };
    }

    function buildFallbackPainting(entry, fileTitle) {
        const title = entry.title || fallbackPaintingTitle(fileTitle);
        const artist = entry.artist || "Unknown artist";

        return {
            fileTitle,
            sourceUrl: entry.url,
            thumbUrl: commonsFileRedirect(fileTitle, PAINTING_GRID_WIDTH),
            carouselFallbackUrl: commonsFileRedirect(fileTitle, PAINTING_CAROUSEL_WIDTH),
            width: entry.width || 1,
            height: entry.height || 1,
            title,
            artist,
            date: entry.date || "",
            medium: entry.medium || "",
            dimensions: entry.dimensions || "",
            collection: entry.collection || "",
            credit: entry.credit || "",
            license: entry.license || "",
            licenseUrl: entry.licenseUrl || "",
            alt: entry.alt || title + " by " + artist
        };
    }

    function paintingRatio(painting) {
        const ratio = painting.width / painting.height;
        return Number.isFinite(ratio) && ratio > 0 ? ratio : 1.5;
    }

    function calculatePaintingRows(containerWidth) {
        if (window.innerWidth < 600) {
            return paintings.map((painting, index) => [index]);
        }

        const gap = parseFloat(getComputedStyle(paintingGrid).getPropertyValue("--painting-gap")) || 16;
        const targetHeight = Math.max(170, Math.min(230, containerWidth * 0.29));
        const minimumHeight = 115;
        const maximumHeight = 320;
        const best = new Array(paintings.length + 1);
        best[paintings.length] = { cost: 0, rows: [] };

        for (let start = paintings.length - 1; start >= 0; start -= 1) {
            let ratioSum = 0;
            let bestCandidate = null;

            for (let end = start; end < paintings.length; end += 1) {
                ratioSum += paintingRatio(paintings[end]);
                const itemCount = end - start + 1;
                const availableWidth = containerWidth - gap * (itemCount - 1);
                if (availableWidth <= 0) {
                    break;
                }

                const rowHeight = availableWidth / ratioSum;
                const deviation = (rowHeight - targetHeight) / targetHeight;
                let cost = deviation * deviation;

                if (itemCount === 1 && paintings.length > 1) {
                    cost += 0.45;
                }
                if (rowHeight < minimumHeight) {
                    const undersize = (minimumHeight - rowHeight) / minimumHeight;
                    cost += undersize * undersize * 4;
                }
                if (rowHeight > maximumHeight) {
                    const oversize = (rowHeight - maximumHeight) / maximumHeight;
                    cost += oversize * oversize * 4;
                }

                const candidate = {
                    cost: cost + best[end + 1].cost,
                    rows: [Array.from({ length: itemCount }, (_, offset) => start + offset), ...best[end + 1].rows]
                };

                if (!bestCandidate || candidate.cost < bestCandidate.cost) {
                    bestCandidate = candidate;
                }
            }

            best[start] = bestCandidate;
        }

        return best[0] ? best[0].rows : paintings.map((painting, index) => [index]);
    }

    function layoutPaintingGrid() {
        if (!paintingGrid || paintingTiles.length === 0 || paintingGrid.clientWidth === 0) {
            return;
        }

        const fragment = document.createDocumentFragment();
        const rows = calculatePaintingRows(paintingGrid.clientWidth);

        rows.forEach((indices) => {
            const row = document.createElement("div");
            row.className = "painting-row";

            indices.forEach((index) => {
                const tile = paintingTiles[index];
                tile.style.setProperty("--painting-ratio", paintingRatio(paintings[index]));
                row.appendChild(tile);
            });

            fragment.appendChild(row);
        });

        paintingGrid.replaceChildren(fragment);
    }

    function renderPaintingGrid() {
        if (!paintingGrid) {
            return;
        }

        paintingTiles = paintings.map((painting, index) => {
            const figure = document.createElement("figure");
            figure.className = "painting-tile";

            const button = document.createElement("button");
            button.className = "painting-open";
            button.type = "button";
            button.setAttribute("aria-label", "Open " + painting.title + " by " + painting.artist);
            button.addEventListener("click", function () {
                openCarousel("paintings", index);
            });

            const image = document.createElement("img");
            image.src = painting.thumbUrl;
            image.alt = painting.alt;
            image.loading = "lazy";
            image.decoding = "async";
            image.width = painting.width;
            image.height = painting.height;
            image.addEventListener("load", function () {
                painting.width = image.naturalWidth;
                painting.height = image.naturalHeight;
                requestAnimationFrame(layoutPaintingGrid);
            });

            button.appendChild(image);
            figure.appendChild(button);
            return figure;
        });

        requestAnimationFrame(layoutPaintingGrid);
    }

    async function loadPaintings() {
        if (!paintingGrid || !paintingStatus) {
            return;
        }

        try {
            const response = await fetch("data/paintings.json");
            if (!response.ok) {
                throw new Error("The paintings list could not be loaded.");
            }

            const entries = await response.json();
            const preparedEntries = entries
                .map((entry) => ({ entry, fileTitle: commonsTitleFromUrl(entry.url) }))
                .filter((item) => item.fileTitle);

            if (preparedEntries.length === 0) {
                throw new Error("No valid Wikimedia Commons file links were found.");
            }

            let pages = [];
            try {
                pages = await fetchCommonsInformation(
                    preparedEntries.map((item) => item.fileTitle),
                    PAINTING_GRID_WIDTH,
                    true
                );
            } catch (error) {
                pages = [];
            }
            const pageMap = new Map(pages.map((page) => [normalizedTitle(page.title), page]));

            paintings = preparedEntries
                .map((item) => (
                    buildPainting(item.entry, item.fileTitle, pageMap.get(normalizedTitle(item.fileTitle)))
                    || buildFallbackPainting(item.entry, item.fileTitle)
                ));

            if (paintings.length === 0) {
                throw new Error("Wikimedia Commons did not return any displayable paintings.");
            }

            renderPaintingGrid();
            paintingStatus.hidden = true;
            paintingOpenButton.disabled = false;
        } catch (error) {
            paintingStatus.textContent = error.message || "The paintings could not be loaded.";
            paintingStatus.classList.add("is-error");
        }
    }

    function addMetadataRow(label, value, link) {
        if (!value || !carouselMetadata) {
            return;
        }

        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");

        if (link) {
            const anchor = document.createElement("a");
            anchor.href = link;
            anchor.textContent = value;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            description.appendChild(anchor);
        } else {
            description.textContent = value;
        }

        carouselMetadata.append(term, description);
    }

    function renderPhoto() {
        carouselCaption.hidden = true;
        carouselCaption.setAttribute("aria-hidden", "true");
        carouselTitle.textContent = "";
        carouselMetadata.replaceChildren();
        carouselSource.removeAttribute("href");
        carouselSource.textContent = "";
        carouselImage.src = photos[currentIndex];
        carouselImage.alt = "";
        carouselCount.textContent = currentIndex + 1 + "/" + photos.length;
    }

    async function largePaintingUrl(painting) {
        if (largePaintingUrls.has(painting.fileTitle)) {
            return largePaintingUrls.get(painting.fileTitle);
        }

        try {
            const pages = await fetchCommonsInformation([painting.fileTitle], PAINTING_CAROUSEL_WIDTH, false);
            const info = pages[0] && pages[0].imageinfo && pages[0].imageinfo[0];
            const url = info && info.thumburl ? info.thumburl : painting.thumbUrl;
            largePaintingUrls.set(painting.fileTitle, url);
            return url;
        } catch (error) {
            return painting.carouselFallbackUrl || painting.thumbUrl;
        }
    }

    async function renderPainting() {
        const painting = paintings[currentIndex];
        carouselCaption.hidden = false;
        carouselCaption.removeAttribute("aria-hidden");
        carouselTitle.textContent = painting.title;
        carouselMetadata.replaceChildren();
        addMetadataRow("Artist", painting.artist);
        addMetadataRow("Date", painting.date);
        addMetadataRow("Medium", painting.medium);
        addMetadataRow("Dimensions", painting.dimensions);
        addMetadataRow("Collection", painting.collection);
        addMetadataRow("Credit", painting.credit);
        addMetadataRow("Rights", painting.license, painting.licenseUrl);
        carouselSource.href = painting.sourceUrl;
        carouselSource.textContent = "View on Wikimedia Commons";
        carouselImage.src = painting.thumbUrl;
        carouselImage.alt = painting.alt;
        carouselCount.textContent = currentIndex + 1 + "/" + paintings.length;

        const expectedPainting = painting;
        const largerUrl = await largePaintingUrl(painting);
        if (isOpen && activeCollection === "paintings" && paintings[currentIndex] === expectedPainting) {
            carouselImage.src = largerUrl;
        }
    }

    function renderCarousel() {
        const items = activeCollection === "paintings" ? paintings : photos;
        const hasMultipleItems = items.length > 1;
        prevButton.hidden = !hasMultipleItems;
        nextButton.hidden = !hasMultipleItems;

        if (activeCollection === "paintings") {
            renderPainting();
        } else {
            renderPhoto();
        }
    }

    function openCarousel(collection, startIndex) {
        const items = collection === "paintings" ? paintings : photos;
        if (items.length === 0) {
            return;
        }

        activeCollection = collection;
        currentIndex = (startIndex + items.length) % items.length;
        previouslyFocusedElement = document.activeElement;
        overlay.setAttribute("aria-label", collection === "paintings" ? "Painting carousel" : "Photo carousel");
        overlay.classList.toggle("has-caption", collection === "paintings");
        overlay.hidden = false;
        overlay.classList.add("is-open");
        document.body.classList.add("carousel-open");
        isOpen = true;
        renderCarousel();
        closeButton.focus();
    }

    function closeCarousel() {
        overlay.classList.remove("is-open");
        overlay.hidden = true;
        document.body.classList.remove("carousel-open");
        carouselImage.removeAttribute("src");
        isOpen = false;

        if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === "function") {
            previouslyFocusedElement.focus();
        }
    }

    function step(direction) {
        const items = activeCollection === "paintings" ? paintings : photos;
        if (items.length === 0) {
            return;
        }
        currentIndex = (currentIndex + direction + items.length) % items.length;
        renderCarousel();
    }

    function keepFocusInCarousel(event) {
        const focusable = Array.from(overlay.querySelectorAll("button:not([disabled]), a[href]"));
        if (focusable.length === 0) {
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    const photoDiscoveryPromise = discoverAdditionalPhotos();
    const paintingsPromise = loadPaintings();

    if (photoOpenButton) {
        photoOpenButton.addEventListener("click", async function () {
            photoOpenButton.disabled = true;
            const label = photoOpenButton.textContent;
            photoOpenButton.textContent = "Loading…";
            await photoDiscoveryPromise;
            photoOpenButton.textContent = label;
            photoOpenButton.disabled = false;
            photoOpenButton.focus({ preventScroll: true });
            openCarousel("photos", 0);
        });
    }

    if (paintingOpenButton) {
        paintingOpenButton.addEventListener("click", async function () {
            await paintingsPromise;
            openCarousel("paintings", 0);
        });
    }

    prevButton.addEventListener("click", function () {
        step(-1);
    });
    nextButton.addEventListener("click", function () {
        step(1);
    });
    closeButton.addEventListener("click", closeCarousel);
    overlay.addEventListener("click", function (event) {
        if (event.target === overlay) {
            closeCarousel();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (!isOpen) {
            return;
        }

        if (event.key === "ArrowRight") {
            step(1);
        } else if (event.key === "ArrowLeft") {
            step(-1);
        } else if (event.key === "Escape") {
            closeCarousel();
        } else if (event.key === "Tab") {
            keepFocusInCarousel(event);
        }
    });

    let resizeFrame = null;
    window.addEventListener("resize", function () {
        if (resizeFrame !== null) {
            cancelAnimationFrame(resizeFrame);
        }
        resizeFrame = requestAnimationFrame(function () {
            layoutPaintingGrid();
            resizeFrame = null;
        });
    });
})();
