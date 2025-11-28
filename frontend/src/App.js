import React, { useEffect, useState, useRef } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  CssBaseline,
  ThemeProvider,
  createTheme,
  TextField,
  Button,
  Box,
  CardMedia,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import DownloadIcon from "@mui/icons-material/Download";
import ShareIcon from "@mui/icons-material/Share";
import LyricsIcon from "@mui/icons-material/Lyrics";
import DeleteIcon from "@mui/icons-material/Delete";

import cubeBg from "./assets/cube-cubic-bg.jpg";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#90caf9" },
    background: {
      default: "#000000",
      paper: "rgba(0,0,0,0.7)",
    },
  },
});

// ПОДСТАВЬТЕ СЮДА СВОЙ URL backend на Render:
const API_URL = "https://ikakoba-mp-backend.onrender.com";

// ==================== КОМПОНЕНТ ПРОФИЛЯ ====================
function ProfileSection() {
  // ЗАМЕНИТЕ ЭТУ ССЫЛКУ НА ВАШУ РЕАЛЬНУЮ ССЫЛКУ С GOOGLE DRIVE
  const profilePhotoUrl = "https://drive.google.com/uc?export=view&id=1ABC123def456GHI789jkl";
  const profileName = "Cube Cubic";
  const profileDescription = "კეთილი იყოს თქვენი მობრძანება";

  return (
    <Box
      sx={{
        textAlign: 'center',
        padding: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 2,
        marginBottom: 4,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <img
        src={profilePhotoUrl}
        alt={profileName}
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '4px solid #90caf9',
          marginBottom: 16,
          boxShadow: '0 4px 20px rgba(144, 202, 249, 0.3)',
        }}
      />
      <Typography variant="h4" gutterBottom sx={{ color: '#ffffff', fontWeight: 'bold' }}>
        {profileName}
      </Typography>
      <Typography variant="h6" sx={{ color: '#90caf9', mb: 2 }}>
        {profileDescription}
      </Typography>
    </Box>
  );
}
// ==================== КОНЕЦ КОМПОНЕНТА ПРОФИЛЯ ====================

function App() {
  const [tracks, setTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [tracksError, setTracksError] = useState("");

  // режим "страница одного трека" (по ссылке ?track=ID)
  const [sharedTrackId, setSharedTrackId] = useState(null);

  // админ
  const [loginName, setLoginName] = useState("admin");
  const [password, setPassword] = useState("adminpass");
  const [token, setToken] = useState(null);
  const [loginError, setLoginError] = useState("");
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  // форма загрузки - ИСПРАВЛЕНА ДЛЯ GOOGLE DRIVE
  const [title, setTitle] = useState("");
  const [googleDriveAudioId, setGoogleDriveAudioId] = useState("");
  const [googleDriveCoverId, setGoogleDriveCoverId] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  // глобальный плеер
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // инициализация: токен + ?track=ID
  useEffect(() => {
    const savedToken = localStorage.getItem("mp_token");
    if (savedToken) setToken(savedToken);

    const params = new URLSearchParams(window.location.search);
    const trackParam = params.get("track");
    let selectedId = null;
    if (trackParam) {
      const parsed = Number(trackParam);
      if (!Number.isNaN(parsed)) selectedId = parsed;
    }
    if (selectedId !== null) setSharedTrackId(selectedId);

    loadTracks(selectedId);
  }, []);

  async function loadTracks(selectTrackId) {
    try {
      setLoadingTracks(true);
      setTracksError("");
      const res = await fetch(`${API_URL}/api/tracks`);
      if (!res.ok) throw new Error(`ტრეკების ჩატვირთვის შეცდომა: ${res.status}`);
      const data = await res.json();
      setTracks(data);

      if (selectTrackId) {
        const found = data.find((t) => t.id === selectTrackId);
        if (found) setCurrentTrack(found);
      }
    } catch (err) {
      setTracksError(err.message);
    } finally {
      setLoadingTracks(false);
    }
  }

  // вход администратора через диалог
  async function handleLoginSubmit() {
    setLoginError("");
    setUploadStatus("");
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: loginName,
          username: loginName,
          password,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `ავტორიზაციის შეცდომა: ${res.status}`);
      }
      const data = await res.json();
      if (!data.token) throw new Error("სერვერმა token არ დააბრუნა.");
      setToken(data.token);
      localStorage.setItem("mp_token", data.token);
      setLoginDialogOpen(false);
    } catch (err) {
      setLoginError(err.message);
    }
  }

  function handleLogout() {
    setToken(null);
    localStorage.removeItem("mp_token");
    setUploadStatus("");
  }

  // ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ GOOGLE DRIVE
  async function handleUpload(e) {
    e.preventDefault();
    setUploadStatus("");
    if (!token) {
      setUploadStatus("ჯერ შედით როგორც ადმინისტრატორი.");
      return;
    }
    if (!googleDriveAudioId) {
      setUploadStatus("შეიყვანეთ Google Drive Audio ID.");
      return;
    }
    try {
      const trackData = {
        title: title || "უსახელო ტრეკი",
        google_drive_audio_id: googleDriveAudioId,
        google_drive_cover_id: googleDriveCoverId || null,
        lyrics: lyrics || ""
      };

      const res = await fetch(`${API_URL}/api/tracks`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(trackData),
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `ატვირთვის შეცდომა: ${res.status}`);
      }

      setUploadStatus("ტრეკი წარმატებით აიტვირთა.");
      setTitle("");
      setGoogleDriveAudioId("");
      setGoogleDriveCoverId("");
      setLyrics("");
      loadTracks(sharedTrackId || null);
    } catch (err) {
      setUploadStatus(`შეცდომა: ${err.message}`);
    }
  }

  const handleTrackPlayPause = (track) => {
    if (!currentTrack || currentTrack.id !== track.id) {
      setCurrentTrack(track);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleGlobalTogglePlay = () => {
    if (!currentTrack) return;
    setIsPlaying((prev) => !prev);
  };

  const handleGlobalEnded = () => {
    setIsPlaying(false);
  };

  async function handleDeleteTrack(id) {
    if (!token) return;
    const confirm = window.confirm("დარწმუნებული ხართ, რომ გსურთ ამ ტრეკის წაშლა?");
    if (!confirm) return;

    try {
      const res = await fetch(`${API_URL}/api/tracks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `წაშლის შეცდომა: ${res.status}`);
      }

      setTracks((prev) => prev.filter((t) => t.id !== id));
      if (currentTrack && currentTrack.id === id) {
        setCurrentTrack(null);
        setIsPlaying(false);
      }
    } catch (err) {
      alert("ვერ წაიშალა ტრეკი: " + err.message);
    }
  }

  const visibleTracks =
    sharedTrackId != null
      ? tracks.filter((t) => t.id === sharedTrackId)
      : tracks;

  const goHome = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("track");
    window.location.href = url.toString();
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          backgroundImage: `url(${cubeBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      >
        {/* верхняя панель: название + логотип (клик для входа админа) */}
        <AppBar
          position="static"
          sx={{
            backgroundColor: "rgba(0,0,0,0.75)",
            boxShadow: "none",
          }}
        >
          <Toolbar
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">
              Cube Cubic - ჩემი მუსიკა თქვენთვის
            </Typography>

            <Box
              component="img"
              src={cubeBg}
              alt="Cube Cubic Logo"
              onClick={() => setLoginDialogOpen(true)}
              sx={{
                height: 48,
                width: 48,
                borderRadius: 1,
                objectFit: "cover",
                boxShadow: 2,
                cursor: "pointer",
              }}
            />
          </Toolbar>
        </AppBar>

        <Container
          sx={{
            mt: 4,
            mb: 10,
            bgcolor: "rgba(0,0,0,0.7)",
            borderRadius: 2,
            py: 2,
          }}
        >
          {/* если открыта страница одного трека — кнопка на главную */}
          {sharedTrackId != null && (
            <Box sx={{ mb: 2, textAlign: "right" }}>
              <Button variant="contained" onClick={goHome}>
                მთავარ გვერდზე
              </Button>
            </Box>
          )}

          {/* форма загрузки — только для админа - ИСПРАВЛЕНА ДЛЯ GOOGLE DRIVE */}
          {token && (
            <Box
              component="form"
              onSubmit={handleUpload}
              sx={{ mb: 4, p: 2, border: "1px solid #333", borderRadius: 2 }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography variant="h6">
                  ადმინისტრატორის გვერდი — ახალი ტრეკის ატვირთვა
                </Typography>
                <Button variant="outlined" color="secondary" onClick={handleLogout}>
                  გამოსვლა
                </Button>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  label="ტრეკის სახელწოდება (არასავალდებულოა)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                {/* ЗАМЕНЕНО НА ПОЛЯ ДЛЯ GOOGLE DRIVE ID */}
                <TextField
                  label="Google Drive Audio ID"
                  value={googleDriveAudioId}
                  onChange={(e) => setGoogleDriveAudioId(e.target.value)}
                  helperText="ID აუდიო ფაილის Google Drive-იდან"
                  required
                />

                <TextField
                  label="Google Drive Cover ID (არასავალდებულოა)"
                  value={googleDriveCoverId}
                  onChange={(e) => setGoogleDriveCoverId(e.target.value)}
                  helperText="ID სურათის Google Drive-იდან"
                />

                <TextField
                  label="სიმღერის ტექსტი (არასავალდებულოა)"
                  multiline
                  minRows={3}
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                />

                <Button type="submit" variant="contained" color="primary">
                  ატვირთვა
                </Button>

                {uploadStatus && (
                  <Typography
                    color={
                      uploadStatus.startsWith("შეცდომა")
                        ? "error"
                        : "success.main"
                    }
                  >
                    {uploadStatus}
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* ========== ПРОФИЛЬ АРТИСТА ========== */}
          {sharedTrackId == null && <ProfileSection />}

          {/* список треков */}
          <Typography variant="h5" gutterBottom>
            ტრეკები
          </Typography>
          {loadingTracks && <Typography>ტრეკების ჩატვირთვა...</Typography>}
          {tracksError && (
            <Typography color="error">{tracksError}</Typography>
          )}

          <Grid container spacing={2}>
            {visibleTracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                onPlayPause={() => handleTrackPlayPause(track)}
                isCurrent={currentTrack && currentTrack.id === track.id}
                isPlaying={isPlaying}
                canDelete={!!token}
                onDelete={() => handleDeleteTrack(track.id)}
              />
            ))}
          </Grid>
        </Container>

        <GlobalPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          onTogglePlay={handleGlobalTogglePlay}
          onEnded={handleGlobalEnded}
        />

        {/* диалог входа администратора */}
        <Dialog
          open={loginDialogOpen}
          onClose={() => setLoginDialogOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>ადმინისტრატორის შესვლა</DialogTitle>
          <DialogContent dividers>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                mt: 1,
              }}
            >
              <TextField
                label="ადმინი"
                size="small"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
              />
              <TextField
                label="პაროლი"
                type="password"
                size="small"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {loginError && (
                <Typography color="error" variant="body2">
                  {loginError}
                </Typography>
              )}

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 1,
                  mt: 1,
                }}
              >
                <Button onClick={() => setLoginDialogOpen(false)}>
                  დახურვა
                </Button>
                <Button variant="contained" onClick={handleLoginSubmit}>
                  შესვლა
                </Button>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TrackCard({
  track,
  onPlayPause,
  isCurrent,
  isPlaying,
  canDelete,
  onDelete,
}) {
  const [liked, setLiked] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  const audioSrc = track.file_url
    ? `${API_URL}${
        track.file_url.startsWith("/") ? "" : "/"
      }${track.file_url}`
    : "";

  const coverSrc = track.cover_url
    ? `${API_URL}${
        track.cover_url.startsWith("/") ? "" : "/"
      }${track.cover_url}`
    : null;

  const playingThis = isCurrent && isPlaying;
  const hasLyrics =
    track.lyrics && String(track.lyrics).trim().length > 0;

  return (
    <Grid item xs={12} md={6} lg={4}>
      <Card
        sx={{
          backgroundColor: "rgba(0,0,0,0.8)",
          borderRadius: 3,
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          height: "100%",
        }}
      >
        <Box sx={{ display: "flex", gap: 2 }}>
          <Box
            sx={{
              width: 120,
              height: 120,
              position: "relative",
              flexShrink: 0,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {coverSrc ? (
              <CardMedia
                component="img"
                image={coverSrc}
                alt={track.title || "ქავერი"}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  bgcolor: "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  ქავერი არ არის
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconButton
                onClick={onPlayPause}
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  bgcolor: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                }}
              >
                {playingThis ? (
                  <PauseIcon fontSize="large" />
                ) : (
                  <PlayArrowIcon fontSize="large" />
                )}
              </IconButton>
            </Box>
          </Box>

          <CardContent sx={{ p: 0, flex: 1 }}>
            <Typography variant="h6">
              {track.title || track.name || track.filename || "უსახელო"}
            </Typography>
          </CardContent>
        </Box>

        <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={liked ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
            onClick={() => setLiked((p) => !p)}
          >
            მოწონება
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<ShareIcon />}
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set("track", track.id);
              const link = url.toString();
              if (navigator.clipboard) {
                navigator.clipboard.writeText(link);
                alert("ბმული დაკოპირდა ბუფერში.");
              } else {
                window.prompt("დააკოპირეთ ბმული:", link);
              }
            }}
          >
            გაზიარება
          </Button>

          {audioSrc && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              component="a"
              href={audioSrc}
              download
            >
              ჩამოტვირთვა
            </Button>
          )}

          <Button
            size="small"
            variant="outlined"
            startIcon={<LyricsIcon />}
            disabled={!hasLyrics}
            onClick={() => setLyricsOpen(true)}
          >
            ტექსტი
          </Button>

          {canDelete && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={onDelete}
            >
              წაშლა
            </Button>
          )}
        </Box>

        <Dialog
          open={lyricsOpen}
          onClose={() => setLyricsOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{track.title || "სიმღერის ტექსტი"}</DialogTitle>
          <DialogContent dividers>
            {hasLyrics ? (
              <Typography
                component="pre"
                sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
              >
                {track.lyrics}
              </Typography>
            ) : (
              <Typography color="text.secondary">
                ამ სიმღერას ტექსტი ჯერ არ აქვს.
              </Typography>
            )}
          </DialogContent>
        </Dialog>
      </Card>
    </Grid>
  );
}

function GlobalPlayer({ track, isPlaying, onTogglePlay, onEnded }) {
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!track || !track.file_url) {
      audio.pause();
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const src = `${API_URL}${
      track.file_url.startsWith("/") ? "" : "/"
    }${track.file_url}`;

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }

    if (isPlaying) {
      audio.play().catch((e) => console.error("Play error:", e));
    } else {
      audio.pause();
    }
  }, [track, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => setDuration(audio.duration || 0);
    const handleTimeUpdate = () =>
      setCurrentTime(audio.currentTime || 0);
    const handleEndedLocal = () => {
      setCurrentTime(0);
      onEnded && onEnded();
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEndedLocal);
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEndedLocal);
    };
  }, [onEnded]);

  if (!track || !track.file_url) return null;

  const handleSeek = (value) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = Number(value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: "rgba(0,0,0,0.85)",
        borderTop: "1px solid #333",
        px: 3,
        py: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 2,
        zIndex: 1300,
      }}
    >
      <IconButton
        onClick={onTogglePlay}
        sx={{ bgcolor: "#333", "&:hover": { bgcolor: "#444" } }}
      >
        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
      </IconButton>

      <Box sx={{ minWidth: 0, mr: 2 }}>
        <Typography noWrap>
          {track.title || track.name || track.filename || "უსახელო"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, mx: 2 }}>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => handleSeek(e.target.value)}
          style={{ width: "100%" }}
        />
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          minWidth: 120,
        }}
      >
        <Typography variant="caption">ხმ.</Typography>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </Box>

      <audio ref={audioRef} />
    </Box>
  );
}

export default App;