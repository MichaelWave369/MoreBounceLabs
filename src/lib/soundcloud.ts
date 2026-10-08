import data from "@/data/soundcloud-albums.json";

export type SoundCloudAlbum = (typeof data.albums)[number];
export const SOUNDCLOUD_ALBUMS: SoundCloudAlbum[] = data.albums;
export const SOUNDCLOUD_PROFILE = "https://soundcloud.com/microneesia/albums";

/** Only publish playlist URLs from the owner's original SoundCloud profile. */
export function validSoundCloudAlbumUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "soundcloud.com"
      && url.pathname.startsWith("/microneesia/sets/")
      && url.pathname.split("/").length === 4
      && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** Official SoundCloud embed, with no streaming URL or authentication keys. */
export function soundCloudWidgetSrc(albumUrl: string): string {
  if (!validSoundCloudAlbumUrl(albumUrl)) return "";
  const params = new URLSearchParams({
    url: albumUrl,
    color: "#e4a04a",
    auto_play: "false",
    visual: "false",
    show_artwork: "true",
    show_user: "true",
    sharing: "true",
    download: "false",
    hide_related: "true",
  });
  return "https://w.soundcloud.com/player/?" + params.toString();
}

export function filteredSoundCloudAlbums(query: string): SoundCloudAlbum[] {
  const term = query.trim().toLowerCase();
  if (!term) return SOUNDCLOUD_ALBUMS;
  return SOUNDCLOUD_ALBUMS.filter((album) =>
    [album.title, album.artist, String(album.year), album.description, "soundcloud", "archive"]
      .join(" ").toLowerCase().includes(term),
  );
}
