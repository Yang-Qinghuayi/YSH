import { useRouter } from 'vue-router';
import { isPWA, isWebAppPlatform } from '@/services/environment';
import { BOOK_IDS_SEPARATOR } from '@/services/constants';

export const useNavigation = () => {
  const router = useRouter();

  const navigateToReader = (
    bookIds: string[],
    queryParams?: string,
    navOptions?: { replace?: boolean },
  ) => {
    const ids = bookIds.join(BOOK_IDS_SEPARATOR);
    if (isWebAppPlatform() && !isPWA()) {
      router.push({
        path: `/reader/${ids}`,
        query: queryParams ? Object.fromEntries(new URLSearchParams(queryParams)) : undefined,
        ...navOptions,
      });
    } else {
      const params = new URLSearchParams(queryParams || '');
      params.set('ids', ids);
      router.push({
        path: '/reader',
        query: Object.fromEntries(params),
        ...navOptions,
      });
    }
  };

  const navigateToLogin = () => {
    const { pathname, search } = window.location;
    const currentPath = pathname !== '/auth' ? pathname + search : '/';
    router.push({
      path: '/auth',
      query: {
        redirect: currentPath,
      },
    });
  };

  const navigateToProfile = () => {
    router.push('/user');
  };

  const navigateToLibrary = (
    queryParams?: string,
    navOptions?: { replace?: boolean },
  ) => {
    router.push({
      path: '/library',
      query: queryParams ? Object.fromEntries(new URLSearchParams(queryParams)) : undefined,
      ...navOptions,
    });
  };

  const redirectToLibrary = () => {
    router.replace('/library');
  };

  return {
    navigateToReader,
    navigateToLogin,
    navigateToProfile,
    navigateToLibrary,
    redirectToLibrary,
  };
};
