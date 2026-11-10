import '@fontsource/zcool-qingke-huangyou';
import './style.css';
import { Game } from './game/game';

const game = new Game(document.getElementById('app')!);
void game.boot();

if (new URLSearchParams(location.search).has('dev')) {
  (window as unknown as { game: Game }).game = game;
}
