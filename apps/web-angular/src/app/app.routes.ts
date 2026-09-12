import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { profileGuard } from './guards/profile.guard';
import { LoginPageComponent } from './pages/login.page';
import { ProfileSelectPageComponent } from './pages/profile-select.page';
import { HomePageComponent } from './pages/home.page';
import { PlayerPageComponent } from './pages/player.page';

// There is deliberately no /series/:id route — series detail (episode list,
// favorite toggle, resume) is the AnizonePreviewModal, opened in place from
// wherever a series is clicked (search, library row, favorites). See
// HomePageComponent.openSeriesPreview.
export const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'profiles', component: ProfileSelectPageComponent, canActivate: [authGuard] },
  { path: '', component: HomePageComponent, canActivate: [authGuard, profileGuard] },
  { path: 'watch/:kind/:id', component: PlayerPageComponent, canActivate: [authGuard, profileGuard] },
  { path: '**', redirectTo: '' },
];
