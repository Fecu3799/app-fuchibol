import { ActivityIndicator, ImageBackground, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Asset } from 'expo-asset';
import { DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';
import CreateMatchScreen from '../screens/CreateMatchScreen';
import GroupsScreen from '../screens/GroupsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MatchHistoryScreen from '../screens/MatchHistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import EditMatchScreen from '../screens/EditMatchScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import SessionsScreen from '../screens/SessionsScreen';

// Preload and decode the auth background as soon as this module is imported,
// so it's ready before the first AuthNavigator render.
const _bg = require('../../assets/bg.jpg') as number;
void Asset.fromModule(_bg).downloadAsync().catch(() => {});

// ── Param lists ──

export type AuthStackParamList = {
  Login: { prefillEmail?: string } | undefined;
  Register: undefined;
  VerifyEmail: { email?: string };
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  GroupsTab: undefined;
  CreateTab: undefined;
  ProfileTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  CreateMatch: undefined;
  MatchDetail: { matchId: string };
  EditMatch: { matchId: string };
  MatchHistory: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string };
  ChangePassword: undefined;
  Sessions: undefined;
};

/** @deprecated Use RootStackParamList instead. Kept for backwards compat with screens. */
export type AppStackParamList = RootStackParamList;

/** Use this ref to navigate imperatively (e.g. from push notification handlers). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ── Navigators ──

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ── Placeholder for Create tab (never rendered — intercepted by listener) ──

function CreateTabPlaceholder() {
  return null;
}

// ── Tab Navigator ──

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { paddingBottom: 4, height: 56 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsScreen}
        options={{ tabBarLabel: 'Groups' }}
      />
      <Tab.Screen
        name="CreateTab"
        component={CreateTabPlaceholder}
        options={{ tabBarLabel: 'Create' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('CreateMatch');
          },
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// ── Auth Navigator ──
// Background is mounted once here — never re-mounts during auth navigation,
// eliminating the per-screen flash.  All screens use transparent contentStyle.

function AuthNavigator() {
  return (
    <View style={authBgStyles.root}>
      {/* Shared background: rendered once behind the entire auth stack */}
      <ImageBackground source={_bg} style={StyleSheet.absoluteFill} resizeMode="cover">
        {/* expo-blur on iOS/Android; dark overlay alone is the web fallback */}
        {Platform.OS !== 'web' && (
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <View style={authBgStyles.overlay} />
      </ImageBackground>

      <AuthStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      >
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
        <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </AuthStack.Navigator>
    </View>
  );
}

const authBgStyles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
});

// ── App Navigator (Root Stack wraps tabs + modal screens) ──

function AppNavigator() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="CreateMatch"
        component={CreateMatchScreen}
        options={{ title: 'Create Match' }}
      />
      <RootStack.Screen
        name="MatchDetail"
        component={MatchDetailScreen}
        options={{ title: 'Match Detail' }}
      />
      <RootStack.Screen
        name="EditMatch"
        component={EditMatchScreen}
        options={{ title: 'Edit Match' }}
      />
      <RootStack.Screen
        name="MatchHistory"
        component={MatchHistoryScreen}
        options={{ title: 'Match History' }}
      />
      <RootStack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: 'Create Group' }}
      />
      <RootStack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ title: 'Group Detail' }}
      />
      <RootStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Change Password' }}
      />
      <RootStack.Screen
        name="Sessions"
        component={SessionsScreen}
        options={{ title: 'Devices' }}
      />
    </RootStack.Navigator>
  );
}

// ── Root ──

export default function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } }}
    >
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
