/* CYBERSLIDE - entry point. Import order matters: each module registers itself on ND, and later ones read
   what earlier ones registered (same order as the <script> tags in the old single-file build). */
import './styles.css';
import './audio';
import './scores';
import './tricks';
import './world';
import './pickups';
import './city';
import './riders';
import './riderSelect';
import './player';
import './tutorial';
import './gamepad';
import { boot } from './game';

boot();
